const jwt = require('jsonwebtoken');

(async () => {
  try {
    console.log("Creating token...");
    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://127.0.0.1:27017/nitin-real-estate');
    const User = require('./models/User');
    const Property = require('./models/Property');

    const testUser = await User.findOne({});
    if (!testUser) {
      console.log("No user found");
      return process.exit(0);
    }
    console.log("User:", testUser.email, testUser._id.toString());

    let testProperty = await Property.findOne({ user_id: testUser._id });
    if (!testProperty) {
      console.log("Creating dummy property for user...");
      testProperty = await Property.create({
        title: "Test Prop",
        description: "Test Desc",
        price: 100,
        location: "Test Loc",
        type: "Apartment",
        contactInfo: "test",
        user_id: testUser._id
      });
    }

    console.log("Target property:", testProperty._id.toString());

    const token = jwt.sign({ user: { id: testUser._id.toString() } }, 'fallback_secret', { expiresIn: '1h' });
    
    console.log("Sending delete request...");
    const response = await fetch(`http://localhost:5000/api/properties/${testProperty._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    console.log("Delete response:", response.status, data);
    process.exit(0);
  } catch (err) {
    console.error("Error encountered:", err.message);
    process.exit(1);
  }
})();
