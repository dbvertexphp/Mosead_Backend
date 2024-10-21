const express = require("express");
const {
  addAboutUs,
  addTermsConditions,
  addPrivacyPolicy,
  getAboutUs,
  getTermsConditions,
  getPrivacyPolicy,
  submitReport,
  addFAQ,
  getFAQs,
} = require("../controllers/companyDetailsController.js");
const { protect } = require("../middleware/authMiddleware");

const companyDetails = express.Router();
companyDetails.route("/addAboutUs").post(protect, addAboutUs);
companyDetails.route("/addTermsConditions").post(protect, addTermsConditions);
companyDetails.route("/addPrivacyPolicy").post(protect, addPrivacyPolicy);
companyDetails.route("/submitReport").post(protect, submitReport);
companyDetails.route("/addFAQ").post(protect, addFAQ);

companyDetails.route("/getAboutUs").get(getAboutUs);
companyDetails.route("/getTermsAndConditions").get(getTermsConditions);
companyDetails.route("/getPrivacyPolicy").get(getPrivacyPolicy);
companyDetails.route("/getFAQQuestions").get(getFAQs);

module.exports = { companyDetails };
