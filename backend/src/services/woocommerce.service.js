const axios = require("axios");

const wc = axios.create({
  baseURL: process.env.WC_BASE_URL, // ej: https://tecnonacho.com/wp-json/wc/v3
  timeout: 10000,
});

exports.searchProducts = async (q) => {
  const res = await wc.get("/products", {
    params: {
      search: q,
      per_page: 12,
      consumer_key: process.env.WC_CONSUMER_KEY,
      consumer_secret: process.env.WC_CONSUMER_SECRET,
    },
  });

  return res.data.map((p) => ({
    id: p.id,
    sku: p.sku,
    nombre: p.name,
    precio: Number(p.price || 0),
    stock: p.manage_stock ? Number(p.stock_quantity ?? 0) : null,
    imagen: p.images?.[0]?.src || null,
  }));
};

exports.getProductBySku = async (sku) => {
  const res = await wc.get("/products", {
    params: {
      sku,
      per_page: 1,
      consumer_key: process.env.WC_CONSUMER_KEY,
      consumer_secret: process.env.WC_CONSUMER_SECRET,
    },
  });

  const p = res.data?.[0];
  if (!p) return null;

  return {
    id: p.id,
    sku: p.sku,
    nombre: p.name,
    precio: Number(p.price || 0),
    stock: p.manage_stock ? Number(p.stock_quantity ?? 0) : null,
    imagen: p.images?.[0]?.src || null,
  };
};
