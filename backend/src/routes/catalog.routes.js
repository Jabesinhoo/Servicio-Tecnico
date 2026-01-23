const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware");
const catalogController = require("../controllers/catalog.controller");

router.get("/catalog/search", authRequired, catalogController.search);
router.get("/catalog/sku/:sku", authRequired, catalogController.bySku);

module.exports = router;
