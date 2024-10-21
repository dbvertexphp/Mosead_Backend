const asyncHandler = require("express-async-handler");
const companyDetailsModel = require("../models/companyDetailsModel.js");

const addAboutUs = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(200).json({
      message: "Please provide content for About Us.",
      status: false,
    });
  }

  try {
    // Check if an "About Us" document already exists
    let aboutUs = await companyDetailsModel.AboutUs.findOne();

    if (aboutUs) {
      // If it exists, update the content
      aboutUs.content = content;
      await aboutUs.save();
    } else {
      // If it doesn't exist, create a new one
      aboutUs = await companyDetailsModel.AboutUs.create({
        content,
      });
    }

    res.status(201).json({ content: aboutUs.content, status: true });
  } catch (error) {
    console.error("Error adding/updating About Us:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const addTermsConditions = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(200).json({
      message: "Please provide content for Terms & Conditions.",
      status: false,
    });
  }

  try {
    // Check if a "Terms & Conditions" document already exists
    let termsConditions = await companyDetailsModel.TermsConditions.findOne();

    if (termsConditions) {
      // If it exists, update the content
      termsConditions.content = content;
      await termsConditions.save();
    } else {
      // If it doesn't exist, create a new one
      termsConditions = await companyDetailsModel.TermsConditions.create({
        content,
      });
    }

    res.status(201).json({ content: termsConditions.content, status: true });
  } catch (error) {
    console.error("Error adding/updating Terms & Conditions:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const addPrivacyPolicy = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(200).json({
      message: "Please provide content for Privacy Policy.",
      status: false,
    });
  }

  try {
    // Check if a Privacy Policy document already exists
    let privacyPolicy = await companyDetailsModel.PrivacyPolicy.findOne();

    if (privacyPolicy) {
      // If it exists, update the content
      privacyPolicy.content = content;
      await privacyPolicy.save();
    } else {
      // If it doesn't exist, create a new one
      privacyPolicy = await companyDetailsModel.PrivacyPolicy.create({
        content,
      });
    }

    res.status(201).json({
      content: privacyPolicy.content,
      status: true,
    });
  } catch (error) {
    console.error("Error adding/updating Privacy Policy:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getAboutUs = asyncHandler(async (req, res) => {
  try {
    const aboutUs = await companyDetailsModel.AboutUs.findOne();
    if (!aboutUs) {
      return res
        .status(404)
        .json({ message: "About Us not found", status: false });
    }
    res.json({ content: aboutUs.content, status: true });
  } catch (error) {
    console.error("Error getting About Us:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getTermsConditions = asyncHandler(async (req, res) => {
  try {
    const termsConditions = await companyDetailsModel.TermsConditions.findOne();
    if (!termsConditions) {
      return res.status(404).json({
        message: "Terms & Conditions not found",
        status: false,
      });
    }
    res.json({ content: termsConditions.content, status: true });
  } catch (error) {
    console.error("Error getting Terms & Conditions:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getPrivacyPolicy = asyncHandler(async (req, res) => {
  try {
    const privacyPolicy = await companyDetailsModel.PrivacyPolicy.findOne();
    if (!privacyPolicy) {
      return res.status(404).json({
        message: "Privacy Policy not found",
        status: false,
      });
    }
    res.json({ content: privacyPolicy.content, status: true });
  } catch (error) {
    console.error("Error getting Privacy Policy:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const submitReport = asyncHandler(async (req, res) => {
  const uid = req.headers.userID; // Get user ID from URL parameters
  const { reason, extra } = req.body;

  // Validate request data
  if (!reason || !extra) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields." });
  }

  // Create a new report instance
  const report = new companyDetailsModel.Report({
    uid,
    reason,
    extra,
  });

  // Save the report to the database
  const savedReport = await report.save();

  // Respond with the saved report details
  res.status(201).json({
    message: "Report submitted successfully",
    status: true,
    report: savedReport,
  });
});

const addFAQ = asyncHandler(async (req, res) => {
  const { question, answer } = req.body;

  // Validate request data
  if (!question || !answer) {
    return res
      .status(400)
      .json({ message: "Please provide both question and answer." });
  }

  // Create a new FAQ instance
  const faq = new companyDetailsModel.FAQ({ question, answer });

  // Save the FAQ to the database
  const savedFAQ = await faq.save();

  // Respond with the saved FAQ details
  res.status(201).json({
    message: "FAQ added successfully",
    faq: savedFAQ,
  });
});

const getFAQs = asyncHandler(async (req, res) => {
  const faqs = await companyDetailsModel.FAQ.find({});
  if (faqs) {
    res.status(201).json({
      _id: faqs._id,
      q: faqs.question,
      a: faqs.answer,
      status: true,
      message: "Fetch faq successfully",
    });
  } else {
    res.status(400);
    throw new Error("FAQ not found");
  }
});

module.exports = {
  addAboutUs,
  addTermsConditions,
  addPrivacyPolicy,
  getAboutUs,
  getTermsConditions,
  getPrivacyPolicy,
  submitReport,
  addFAQ,
  getFAQs,
};
