import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        try {
          const data = JSON.parse(decodedText);
          onScan(data);
          scanner.clear();
        } catch (e) {
          // If not JSON, pass raw text
          onScan({ raw: decodedText });
        }
      },
      (error) => {
        // Silent error handling for continuous scanning
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="text-xl">📷</span>
            <span className="text-white font-bold text-sm">Scan QR Code</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl w-7 h-7 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <div id="qr-reader" className="w-full"></div>
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center mt-3">
            Position QR code within the frame
          </p>
        </div>
      </div>
    </div>
  );
}