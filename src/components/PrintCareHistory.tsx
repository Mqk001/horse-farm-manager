'use client';
export function PrintCareHistory() {
  return <button type="button" className="button-primary" onClick={() => window.print()}>Print / Save PDF</button>;
}
