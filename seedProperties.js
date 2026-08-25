const mongoose = require('mongoose');
const Property = require('./models/Property');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nitin-real-estate';

const sampleProperties = [
  {
    title: 'The Royal Heritage Villa',
    description: 'Magnificent 6 BHK Rajasthani architectural heritage villa with private swimming pool, landscaped royal gardens, and traditional marble interiors.',
    price: 125000000,
    location: 'Civil Lines, Jaipur, Rajasthan',
    type: 'Villa',
    contactInfo: '+91 91666 80296',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Skyline Luxury Penthouse',
    description: 'Ultra-exclusive 4 BHK duplex penthouse featuring panoramic Arabian sea views, private plunge pool, and floor-to-ceiling glass windows.',
    price: 280000000,
    location: 'Worli, Mumbai, Maharashtra',
    type: 'Apartment',
    contactInfo: '+91 98200 11223',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Sunset Bay Oceanfront Villa',
    description: 'Contemporary Portuguese-style 5 BHK ocean-facing villa with private beach access, infinity pool, and lush palm gardens.',
    price: 95000000,
    location: 'Anjuna Beach, Goa',
    type: 'Villa',
    contactInfo: '+91 98221 44556',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Green Valley Premium Residential Plot',
    description: 'Prime 500 sq. yard East-facing corner residential plot in a gated luxury township with 60ft wide roads and club house membership.',
    price: 18000000,
    location: 'Jagatpura, Jaipur, Rajasthan',
    type: 'Plot',
    contactInfo: '+91 91666 80296',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'The Glass Horizon Estate',
    description: 'Architecturally crafted 5 BHK smart home equipped with private elevator, heated swimming pool, automated domotics, and subterranean wine cellar.',
    price: 165000000,
    location: 'Golf Course Road, Gurgaon, Haryana',
    type: 'Villa',
    contactInfo: '+91 99100 88776',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Elysium Towers Penthouse Suite',
    description: 'Premium 4 BHK high-rise residence in central Bengaluru with private sky garden, 360-degree city views, and double-height ceiling lounge.',
    price: 140000000,
    location: 'UB City, Bangalore, Karnataka',
    type: 'Apartment',
    contactInfo: '+91 98450 33445',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Aravalli Hills Farmhouse Plot',
    description: '2 Acre fertile farmhouse land parcel surrounded by serene Aravalli hills, complete with boundary wall, borewell, and electricity setup.',
    price: 35000000,
    location: 'Ajmer Road, Jaipur, Rajasthan',
    type: 'Plots',
    contactInfo: '+91 91666 80296',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Modern Woodland Sanctuary',
    description: 'Luxury wooden pine wood chalet nestled in pine forests featuring central fireplace, heated wooden flooring, and snow peak views.',
    price: 72000000,
    location: 'Shimla Hills, Himachal Pradesh',
    type: 'Villa',
    contactInfo: '+91 98160 77889',
    image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'The Grand Palm Mansion',
    description: 'Super-luxury 7 BHK beachfront mansion with private yacht dock, infinity pool over the ocean, and Italian marble finishes.',
    price: 450000000,
    location: 'Palm Jumeirah, Dubai',
    type: 'Villa',
    contactInfo: '+971 50 123 4567',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Lakeside Haven Luxury Apartment',
    description: 'Elegant 3 BHK lake-facing apartment near Fateh Sagar Lake featuring royal interior design, wide private balconies, and rooftop infinity lounge.',
    price: 25000000,
    location: 'Udaipur, Rajasthan',
    type: 'Apartment',
    contactInfo: '+91 91666 80296',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Cybercity Commercial Town Plot',
    description: 'Prime commercial corner plot measuring 350 sq. yards on main 100ft road, approved for multi-storey commercial building or showroom.',
    price: 42000000,
    location: 'Vaishali Nagar, Jaipur, Rajasthan',
    type: 'Plots',
    contactInfo: '+91 91666 80296',
    image: 'https://images.unsplash.com/photo-1524813686514-a57563d77965?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'The Crest Minimalist Villa',
    description: 'Ultra-modern minimalist villa featuring smart home automation, private infinity pool, Zen courtyard, and private gym.',
    price: 110000000,
    location: 'Banjara Hills, Hyderabad, Telangana',
    type: 'Villa',
    contactInfo: '+91 98490 66778',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Imperial Park View Residence',
    description: 'Exclusive 4 BHK luxury apartment with private elevator landing, view of central green parks, concierge services, and 4 car parking spaces.',
    price: 320000000,
    location: 'Lutyens Delhi, New Delhi',
    type: 'Apartment',
    contactInfo: '+91 98110 55443',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  },
  {
    title: 'Serene Valley Eco Plot',
    description: '1.5 Acre eco-friendly hill station plot overlooking misty valleys, perfect for luxury resort development or private holiday retreat.',
    price: 15000000,
    location: 'Kodaikanal, Tamil Nadu',
    type: 'Plot',
    contactInfo: '+91 94430 88990',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    isApproved: true
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    let user = await User.findOne({ email: 'nikn63641@gmail.com' });
    if (user) {
      user.password = 'nitin123';
      user.role = 'Admin';
      user.isVerified = true;
      await user.save();
    } else {
      user = await User.create({
        name: 'Nitin Admin',
        email: 'nikn63641@gmail.com',
        password: 'nitin123',
        role: 'Admin',
        isVerified: true
      });
      console.log('Created default admin user (nikn63641@gmail.com) for property assignment');
    }

    const propertiesWithUser = sampleProperties.map(p => ({
      ...p,
      user_id: user._id
    }));

    await Property.insertMany(propertiesWithUser);
    console.log(`Successfully added ${sampleProperties.length} demo properties to MongoDB!`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
