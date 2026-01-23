const woo = require("../services/woocommerce.service");

exports.search = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json([]);

    const data = await woo.searchProducts(q);
    res.json(data);
  } catch (err) {
    console.error("Woo search error:", err?.response?.data || err.message);
    res.status(500).json({ message: "Error consultando WooCommerce" });
  }
};

exports.bySku = async (req, res) => {
  try {
    const sku = (req.params.sku || "").trim();
    if (!sku) return res.status(400).json({ message: "SKU requerido" });

    const product = await woo.getProductBySku(sku);
    if (!product) return res.status(404).json({ message: "No existe ese SKU" });

    res.json(product);
  } catch (err) {
    console.error("Woo sku error:", err?.response?.data || err.message);
    res.status(500).json({ message: "Error consultando WooCommerce" });
  }
};
