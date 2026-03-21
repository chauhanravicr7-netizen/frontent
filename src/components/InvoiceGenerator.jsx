import React from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { sb } from "../lib/supabase";

/**
 * Generates PDF invoices using company template + dynamic data
 */
export async function generateInvoicePDF(data, companyId, type = "invoice") {
  try {
    // Fetch company template
    const { data: template, error: templateError } = await sb
      .from("company_templates")
      .select("template_data, file_name")
      .eq("company_id", companyId)
      .eq("template_type", type)
      .single();

    if (templateError || !template) {
      // No template - generate basic PDF
      return generateBasicPDF(data, type);
    }

    // Template exists - overlay data on template
    return generateTemplatedPDF(data, template, type);
  } catch (e) {
    console.error("PDF Generation Error:", e);
    return generateBasicPDF(data, type);
  }
}

/**
 * Generate PDF with uploaded template
 */
async function generateTemplatedPDF(data, template, type) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  try {
    // Convert template bytes to blob
    const templateBlob = new Blob([template.template_data], {
      type: "application/pdf",
    });
    const templateUrl = URL.createObjectURL(templateBlob);

    // Load template as background
    const templatePdf = await fetch(templateUrl).then((res) =>
      res.arrayBuffer()
    );
    const loadedPdf = await pdf.loadFile(templatePdf);

    // Add first page of template as background
    pdf.addImage(loadedPdf, "PDF", 0, 0, 210, 297);

    // Overlay dynamic data
    if (type === "invoice" && data.type === "deal") {
      overlayDealData(pdf, data);
    } else if (type === "invoice" && data.type === "inventory") {
      overlayInventoryData(pdf, data);
    }

    // Save
    pdf.save(
      `${type}_${data.product_name || data.customer_name || "document"}_${Date.now()}.pdf`
    );

    URL.revokeObjectURL(templateUrl);
    return { success: true };
  } catch (e) {
    console.error("Template PDF error:", e);
    return generateBasicPDF(data, type);
  }
}

/**
 * Overlay deal data on template
 */
function overlayDealData(pdf, deal) {
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);

  // Customer details (adjust coordinates as needed)
  pdf.text(`Customer: ${deal.customer_name || "—"}`, 20, 80);
  pdf.text(`Deal #: ${deal.deal_number || "—"}`, 20, 90);

  // Product details
  pdf.text(`Product: ${deal.product_name || "—"}`, 20, 100);
  pdf.text(`Quantity: ${deal.quantity || 0}`, 20, 110);
  pdf.text(`Rate: ₹${(deal.negotiated_price || 0).toLocaleString("en-IN")}`, 20, 120);

  // Total
  pdf.setFontSize(12);
  pdf.setFont(undefined, "bold");
  pdf.text(
    `Total: ₹${(deal.total_value || 0).toLocaleString("en-IN")}`,
    20,
    140
  );

  // Date
  pdf.setFontSize(9);
  pdf.setFont(undefined, "normal");
  pdf.text(
    `Date: ${new Date(deal.created_at || Date.now()).toLocaleDateString("en-IN")}`,
    20,
    150
  );
}

/**
 * Overlay inventory data on template
 */
function overlayInventoryData(pdf, item) {
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);

  pdf.text(`Product: ${item.product_name || "—"}`, 20, 80);
  pdf.text(`Category: ${item.category || "—"}`, 20, 90);
  pdf.text(`Wood Type: ${item.wood_type || "—"}`, 20, 100);
  pdf.text(`Grade: ${item.quality_grade || item.grade || "—"}`, 20, 110);
  pdf.text(`Quantity: ${item.available_quantity || 0} ${item.unit || ""}`, 20, 120);
  pdf.text(
    `Cost: ₹${(item.cost_price || 0).toLocaleString("en-IN")} per ${item.unit || "unit"}`,
    20,
    130
  );
  pdf.text(
    `Total Value: ₹${((item.cost_price || 0) * (item.available_quantity || 0)).toLocaleString("en-IN")}`,
    20,
    140
  );
  pdf.text(`Yard: ${item.yard_name || "—"}`, 20, 150);
  pdf.text(`Supplier: ${item.supplier_name || "—"}`, 20, 160);
}

/**
 * Fallback: Generate basic PDF without template
 */
function generateBasicPDF(data, type) {
  const pdf = new jsPDF();

  // Header
  pdf.setFontSize(18);
  pdf.setFont(undefined, "bold");
  pdf.text("DOCKSIDE TRADE OS", 105, 20, { align: "center" });

  pdf.setFontSize(12);
  pdf.setFont(undefined, "normal");
  pdf.text(type.toUpperCase(), 105, 30, { align: "center" });

  // Line separator
  pdf.setLineWidth(0.5);
  pdf.line(20, 35, 190, 35);

  if (data.type === "deal") {
    // Deal invoice
    pdf.setFontSize(10);
    pdf.text(`Deal Number: ${data.deal_number || "—"}`, 20, 50);
    pdf.text(`Customer: ${data.customer_name || "—"}`, 20, 60);
    pdf.text(`Product: ${data.product_name || "—"}`, 20, 70);
    pdf.text(`Quantity: ${data.quantity || 0}`, 20, 80);
    pdf.text(
      `Rate: ₹${(data.negotiated_price || 0).toLocaleString("en-IN")}`,
      20,
      90
    );
    pdf.text(
      `Total: ₹${(data.total_value || 0).toLocaleString("en-IN")}`,
      20,
      100
    );
    pdf.text(`Payment Status: ${data.payment_status || "—"}`, 20, 110);
    pdf.text(`Stage: ${data.stage || data.status || "—"}`, 20, 120);
    pdf.text(
      `Date: ${new Date(data.created_at || Date.now()).toLocaleDateString("en-IN")}`,
      20,
      130
    );
  } else if (data.type === "inventory") {
    // Inventory detail
    pdf.setFontSize(10);
    pdf.text(`Product: ${data.product_name || "—"}`, 20, 50);
    pdf.text(`Category: ${data.category || "—"}`, 20, 60);
    pdf.text(`Wood Type: ${data.wood_type || "—"}`, 20, 70);
    pdf.text(`Grade: ${data.quality_grade || data.grade || "—"}`, 20, 80);
    pdf.text(
      `Quantity: ${data.available_quantity || 0} ${data.unit || ""}`,
      20,
      90
    );
    pdf.text(
      `Cost: ₹${(data.cost_price || 0).toLocaleString("en-IN")} per ${data.unit || "unit"}`,
      20,
      100
    );
    pdf.text(
      `Total Value: ₹${((data.cost_price || 0) * (data.available_quantity || 0)).toLocaleString("en-IN")}`,
      20,
      110
    );
    pdf.text(`Yard: ${data.yard_name || "—"}`, 20, 120);
    pdf.text(`Supplier: ${data.supplier_name || "—"}`, 20, 130);
    pdf.text(`Status: ${data.deal_status || "Available"}`, 20, 140);
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text("Generated by Dockside Trade OS", 105, 280, { align: "center" });
  pdf.text(new Date().toLocaleString("en-IN"), 105, 285, { align: "center" });

  pdf.save(
    `${type}_${data.product_name || data.customer_name || "document"}_${Date.now()}.pdf`
  );

  return { success: true };
}

export default { generateInvoicePDF };