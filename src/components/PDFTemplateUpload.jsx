import React, { useState, useEffect } from "react";
import { sb } from "../lib/supabase";
import { Btn, Field, ErrBanner, Spinner } from "../shared";

export default function PDFTemplateUpload({ companyId, user }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, [companyId]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb
        .from("company_templates")
        .select("*")
        .eq("company_id", companyId);

      if (error) throw error;
      setTemplates(data || []);
    } catch (e) {
      console.error("Fetch templates error:", e);
    }
    setLoading(false);
  };

  const handleUpload = async (e, templateType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErr("Only PDF files are allowed");
      return;
    }

    setUploading(true);
    setErr("");

    try {
      // Read file as binary
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Check if template exists
      const { data: existing } = await sb
        .from("company_templates")
        .select("id")
        .eq("company_id", companyId)
        .eq("template_type", templateType)
        .single();

      if (existing) {
        // Update existing
        const { error } = await sb
          .from("company_templates")
          .update({
            template_data: bytes,
            file_name: file.name,
            uploaded_at: new Date().toISOString(),
            uploaded_by: user.id,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await sb.from("company_templates").insert([
          {
            company_id: companyId,
            template_type: templateType,
            template_data: bytes,
            file_name: file.name,
            uploaded_by: user.id,
          },
        ]);

        if (error) throw error;
      }

      alert("✅ Template uploaded successfully!");
      fetchTemplates();
    } catch (e) {
      setErr(e.message || "Upload failed");
    }
    setUploading(false);
  };

  const downloadTemplate = async (template) => {
    try {
      const { data, error } = await sb
        .from("company_templates")
        .select("template_data, file_name")
        .eq("id", template.id)
        .single();

      if (error) throw error;

      const blob = new Blob([data.template_data], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.file_name || "template.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed: " + e.message);
    }
  };

  if (loading) return <Spinner />;

  const invoiceTemplate = templates.find((t) => t.template_type === "invoice");

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📄</span>
          <div className="flex-1">
            <p className="font-bold text-blue-900 text-sm mb-1">
              PDF Template System
            </p>
            <p className="text-blue-700 text-xs leading-relaxed">
              Upload your company's invoice template (PDF). All generated
              invoices and reports will use this format with your branding,
              letterhead, and company details.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-4">Invoice Template</h3>

        {invoiceTemplate ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-800 text-sm">
                  ✅ Template Active
                </p>
                <p className="text-green-600 text-xs mt-0.5">
                  {invoiceTemplate.file_name}
                </p>
                <p className="text-green-500 text-xs mt-0.5">
                  Uploaded:{" "}
                  {new Date(invoiceTemplate.uploaded_at).toLocaleDateString(
                    "en-IN"
                  )}
                </p>
              </div>
              <button
                onClick={() => downloadTemplate(invoiceTemplate)}
                className="text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-green-50"
              >
                📥 Download
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-center">
            <p className="text-gray-400 text-sm">
              No template uploaded yet. Upload your PDF template below.
            </p>
          </div>
        )}

        <Field label="Upload New Template">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => handleUpload(e, "invoice")}
            disabled={uploading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
        </Field>

        {uploading && (
          <div className="flex items-center gap-2 text-blue-600 text-sm mt-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Uploading template...</span>
          </div>
        )}

        <ErrBanner msg={err} />

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-amber-800 text-xs font-semibold mb-1">
            📌 Template Requirements:
          </p>
          <ul className="text-amber-700 text-xs space-y-1 list-disc list-inside">
            <li>File format: PDF only</li>
            <li>Include your company letterhead and branding</li>
            <li>The system will overlay data on this template</li>
            <li>Max file size: 5MB</li>
          </ul>
        </div>
      </div>
    </div>
  );
}