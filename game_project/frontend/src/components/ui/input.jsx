import React from "react";

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  );
}
