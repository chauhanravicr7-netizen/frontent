import React from "react";
import jsPDF from "jspdf";
import { sb } from "../lib/supabase";

/**
 * Generates PDF invoices using company template + dynamic data
 */
export async function generateInvoicePDF(data, companyId, type = "invoice") {
  try {
    const { data: template, error: templateError } = await sb
      .from("company_templates")
      .select("template_data, file_name")
      .eq("company_id", companyId)
      .eq("template_type", type)
      .single();

    if (templateError || !template?.template_data) {
      return generateBasicPDF(data, type);
    }

    return generateTemplatedPDF(data, template, type);
  } catch (e) {
    console.error("PDF Generation Error:", e);
    return generateBasicPDF(data, type);
  }
}

/**
 * Render uploaded PDF template as image background, then overlay data.
 * Uses the browser's native PDF rendering via an iframe/canvas trick.
 */
async function generateTemplatedPDF(data, template, type) {
  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Convert stored bytes to object URL
    const bytes = new Uint8Array(template.template_data);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    // Render first page of the PDF to a canvas via a hidden iframe
    const bgDataUrl = await renderPDFPageToDataURL(blobUrl);
    URL.revokeObjectURL(blobUrl);

    if (bgDataUrl) {
      // Add template as full-page background image
      pdf.addImage(bgDataUrl, "PNG", 0, 0, 210, 297);
    }

    // Overlay dynamic data on top
    if (data.type === "deal") {
      overlayDealData(pdf, data);
    } else if (data.type === "inventory") {
      overlayInventoryData(pdf, data);
    }

    pdf.save(`${type}_${data.product_name || data.customer_name || "document"}_${Date.now()}.pdf`);
    return { success: true };
  } catch (e) {
    console.error("Template PDF error:", e);
    return generateBasicPDF(data, type);
  }
}

/**
 * Renders the first page of a PDF blob URL to a PNG data URL using canvas.
 * Requires pdf.js (loaded via CDN) or falls back to null.
 */
async function renderPDFPageToDataURL(pdfUrl) {
  try {
    // Dynamically load pdf.js if not already loaded
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    // Render at 2x scale for quality (A4 at 96dpi ≈ 794×1123px; 2x = 1588×2246)
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("PDF page render failed:", e);
    return null;
  }
}

function overlayDealData(pdf, deal) {
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Customer: ${deal.customer_name || "—"}`, 20, 80);
  pdf.text(`Deal #: ${deal.deal_number || "—"}`, 20, 90);
  pdf.text(`Product: ${deal.product_name || "—"}`, 20, 100);
  pdf.text(`Quantity: ${deal.quantity || 0}`, 20, 110);
  pdf.text(`Rate: ₹${(deal.negotiated_price || 0).toLocaleString("en-IN")}`, 20, 120);
  pdf.setFontSize(12);
  pdf.setFont(undefined, "bold");
  pdf.text(`Total: ₹${(deal.total_value || 0).toLocaleString("en-IN")}`, 20, 140);
  pdf.setFontSize(9);
  pdf.setFont(undefined, "normal");
  pdf.text(`Payment: ${deal.payment_status || "—"}`, 20, 150);
  pdf.text(`Stage: ${deal.stage || deal.status || "—"}`, 20, 158);
  pdf.text(`Date: ${new Date(deal.created_at || Date.now()).toLocaleDateString("en-IN")}`, 20, 166);
}

function overlayInventoryData(pdf, item) {
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Product: ${item.product_name || "—"}`, 20, 80);
  pdf.text(`Category: ${item.category || "—"}`, 20, 90);
  pdf.text(`Wood Type: ${item.wood_type || "—"}`, 20, 100);
  pdf.text(`Grade: ${item.quality_grade || item.grade || "—"}`, 20, 110);
  pdf.text(`Quantity: ${item.available_quantity || 0} ${item.unit || ""}`, 20, 120);
  pdf.text(`Cost: ₹${(item.cost_price || 0).toLocaleString("en-IN")} per ${item.unit || "unit"}`, 20, 130);
  pdf.text(`Total Value: ₹${((item.cost_price || 0) * (item.available_quantity || 0)).toLocaleString("en-IN")}`, 20, 140);
  pdf.text(`Yard: ${item.yard_name || "—"}`, 20, 150);
  pdf.text(`Supplier: ${item.supplier_name || "—"}`, 20, 160);
}

function generateBasicPDF(data, type) {
  const pdf = new jsPDF();

  pdf.setFontSize(18);
  pdf.setFont(undefined, "bold");
  pdf.text("DOCKSIDE TRADE OS", 105, 20, { align: "center" });
  pdf.setFontSize(12);
  pdf.setFont(undefined, "normal");
  pdf.text(type.toUpperCase(), 105, 30, { align: "center" });
  pdf.setLineWidth(0.5);
  pdf.line(20, 35, 190, 35);

  if (data.type === "deal") {
    pdf.setFontSize(10);
    pdf.text(`Deal Number: ${data.deal_number || "—"}`, 20, 50);
    pdf.text(`Customer: ${data.customer_name || "—"}`, 20, 60);
    pdf.text(`Product: ${data.product_name || "—"}`, 20, 70);
    pdf.text(`Quantity: ${data.quantity || 0}`, 20, 80);
    pdf.text(`Rate: ₹${(data.negotiated_price || 0).toLocaleString("en-IN")}`, 20, 90);
    pdf.text(`Total: ₹${(data.total_value || 0).toLocaleString("en-IN")}`, 20, 100);
    pdf.text(`Payment: ${data.payment_status || "—"}`, 20, 110);
    pdf.text(`Stage: ${data.stage || data.status || "—"}`, 20, 120);
    pdf.text(`Date: ${new Date(data.created_at || Date.now()).toLocaleDateString("en-IN")}`, 20, 130);
  } else if (data.type === "inventory") {
    pdf.setFontSize(10);
    pdf.text(`Product: ${data.product_name || "—"}`, 20, 50);
    pdf.text(`Category: ${data.category || "—"}`, 20, 60);
    pdf.text(`Wood Type: ${data.wood_type || "—"}`, 20, 70);
    pdf.text(`Grade: ${data.quality_grade || data.grade || "—"}`, 20, 80);
    pdf.text(`Quantity: ${data.available_quantity || 0} ${data.unit || ""}`, 20, 90);
    pdf.text(`Cost: ₹${(data.cost_price || 0).toLocaleString("en-IN")} per ${data.unit || "unit"}`, 20, 100);
    pdf.text(`Total Value: ₹${((data.cost_price || 0) * (data.available_quantity || 0)).toLocaleString("en-IN")}`, 20, 110);
    pdf.text(`Yard: ${data.yard_name || "—"}`, 20, 120);
    pdf.text(`Supplier: ${data.supplier_name || "—"}`, 20, 130);
    pdf.text(`Status: ${data.deal_status || "Available"}`, 20, 140);
  }

  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text("Generated by Dockside Trade OS", 105, 280, { align: "center" });
  pdf.text(new Date().toLocaleString("en-IN"), 105, 285, { align: "center" });

  pdf.save(`${type}_${data.product_name || data.customer_name || "document"}_${Date.now()}.pdf`);
  return { success: true };
}

export default { generateInvoicePDF };
