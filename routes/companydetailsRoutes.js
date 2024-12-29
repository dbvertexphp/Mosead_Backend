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
companyDetails.route("/addAboutUs").post(addAboutUs);
companyDetails.route("/addTermsConditions").post(addTermsConditions);
companyDetails.route("/addPrivacyPolicy").post(addPrivacyPolicy);
companyDetails.route("/submitReport").post(submitReport);
companyDetails.route("/addFAQ").post(addFAQ);

companyDetails.route("/getAboutUs").get(getAboutUs);
companyDetails.route("/getTermsAndConditions").get(getTermsConditions);
companyDetails.route("/getPrivacyPolicy").get(getPrivacyPolicy);
companyDetails.route("/getFAQQuestions").get(getFAQs);

module.exports = { companyDetails };
