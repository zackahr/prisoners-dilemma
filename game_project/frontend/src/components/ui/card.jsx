import React from "react";

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl bg-white shadow-md p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return <div className={`border-b pb-2 mb-2 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }) {
  return <h2 className={`text-xl font-bold ${className}`}>{children}</h2>;
}

export function CardContent({ children, className = "" }) {
  return <div className={`${className}`}>{children}</div>;
}

export function CardDescription({ children, className = "" }) {
  return <p className={`text-sm text-gray-600 ${className}`}>{children}</p>;
}
