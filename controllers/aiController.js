const { GoogleGenAI, Type } = require('@google/genai');
const Property = require('../models/Property');
const fs = require('fs');

// Initialize Gemini SDK
// Assumes GEMINI_API_KEY is available in process.env
const ai = new GoogleGenAI({}); 

/**
 * Smart Natural Language Search
 * Accepts a user query and extracts search filters, then queries the DB.
 */
exports.parseSearch = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        bhk: { type: Type.INTEGER, description: 'Number of bedrooms (BHK). Return 0 if not specified.' },
        maxPrice: { type: Type.INTEGER, description: 'Maximum price in INR. Convert words like lakhs/crores to numbers. Return 0 if not specified.' },
        location: { type: Type.STRING, description: 'Location, locality or city. Empty string if not specified.' },
        amenities: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of amenities like parking, pool, etc.' },
        propertyType: { type: Type.STRING, description: 'Property type: Apartment, Villa, Plot, or empty string if not specified.' }
      },
      required: ['bhk', 'maxPrice', 'location', 'amenities', 'propertyType']
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract the real estate search criteria from the following query: "${query}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1,
      }
    });

    const filters = JSON.parse(response.text());

    // Build MongoDB query
    const dbQuery = { isApproved: true };

    if (filters.maxPrice > 0) {
      dbQuery.price = { $lte: filters.maxPrice };
    }
    if (filters.location) {
      // Fuzzy match on location
      dbQuery.location = { $regex: new RegExp(filters.location, 'i') };
    }
    if (filters.propertyType && ['Apartment', 'Villa', 'Plot', 'Plots'].includes(filters.propertyType)) {
      dbQuery.type = filters.propertyType;
    }
    
    // Note: BHK and amenities are not currently standard fields in Property schema, 
    // but we might search the description for them.
    if (filters.bhk > 0 || (filters.amenities && filters.amenities.length > 0)) {
      let keywords = [];
      if (filters.bhk > 0) keywords.push(`${filters.bhk} BHK`);
      if (filters.amenities) keywords.push(...filters.amenities);
      
      if (keywords.length > 0) {
         // Create a regex to search description or title for these keywords
         const keywordRegex = keywords.map(k => `(?=.*${k})`).join('');
         dbQuery.$or = [
           { description: { $regex: new RegExp(keywordRegex, 'i') } },
           { title: { $regex: new RegExp(keywordRegex, 'i') } }
         ];
      }
    }

    const properties = await Property.find(dbQuery).sort({ createdAt: -1 });

    res.json({
      success: true,
      parsedQuery: filters,
      results: properties
    });

  } catch (err) {
    console.error('Smart Search Error:', err);
    res.status(500).json({ error: 'Failed to process smart search' });
  }
};


/**
 * AI Property Valuation & Fair Market Estimator
 * Accepts property parameters and provides valuation insights.
 */
exports.estimatePrice = async (req, res) => {
  try {
    const { areaSqFt, bhk, locality, floor, ageOfBuilding, furnishing } = req.body;

    if (!areaSqFt || !locality) {
      return res.status(400).json({ error: 'Area (sq ft) and locality are required fields.' });
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        estimatedPriceRange: { type: Type.STRING, description: 'Formatted estimated price range in INR (e.g., "₹50 Lakhs - ₹60 Lakhs").' },
        pricePerSqFt: { type: Type.INTEGER, description: 'Estimated price per square foot in INR.' },
        rentalYield: { type: Type.NUMBER, description: 'Estimated annual rental yield percentage (e.g., 4.5).' },
        rationale: { type: Type.STRING, description: 'A short 2-sentence rationale explaining the valuation based on the provided parameters.' }
      },
      required: ['estimatedPriceRange', 'pricePerSqFt', 'rentalYield', 'rationale']
    };

    const prompt = `Act as an expert real estate appraiser in India. Provide a fair market valuation for a property with the following details:
- Locality: ${locality}
- Area: ${areaSqFt} sq ft
- Bedrooms (BHK): ${bhk || 'N/A'}
- Floor: ${floor || 'N/A'}
- Age of Building: ${ageOfBuilding || 'N/A'} years
- Furnishing: ${furnishing || 'N/A'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.3,
      }
    });

    const valuation = JSON.parse(response.text());

    res.json({
      success: true,
      valuation
    });

  } catch (err) {
    console.error('Valuation Error:', err);
    res.status(500).json({ error: 'Failed to estimate property value' });
  }
};


/**
 * AI Image Analyzer for Listing Uploads
 * Analyzes the uploaded image for quality and room type.
 */
exports.analyzeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    
    // Read image as base64 for Gemini
    const imageBuffer = fs.readFileSync(filePath);
    const base64Data = imageBuffer.toString('base64');
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        roomType: { type: Type.STRING, description: 'The type of room or view shown (e.g., "Modular Kitchen", "Master Bedroom", "Balcony", "Exterior", "Living Room", "Bathroom").' },
        isBlurred: { type: Type.BOOLEAN, description: 'True if the image is blurry, poorly lit, or out of focus.' },
        qualityScore: { type: Type.INTEGER, description: 'An integer score from 1 to 10 evaluating the photo quality and appeal for a real estate listing.' }
      },
      required: ['roomType', 'isBlurred', 'qualityScore']
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        'Analyze this real estate listing photo. Identify the room type, determine if the image is blurry or poor quality, and give a quality score from 1 to 10.'
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1,
      }
    });

    // Delete the temporary file asynchronously so we don't block
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temp image file:', err);
    });

    const analysis = JSON.parse(response.text());

    res.json({
      success: true,
      analysis
    });

  } catch (err) {
    console.error('Image Analysis Error:', err);
    // Cleanup on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: 'Failed to analyze image' });
  }
};
