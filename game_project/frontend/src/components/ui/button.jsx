import React from "react";

export function Button({ children, className = "", variant = "solid", ...props }) {
  const baseStyle = "rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none transition";
  
  const variantStyle =
    variant === "outline"
      ? "border border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
      : variant === "destructive"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : "bg-blue-600 hover:bg-blue-700 text-white";

  return (
    <button className={`${baseStyle} ${variantStyle} ${className}`} {...props}>
      {children}
    </button>
  );
}
