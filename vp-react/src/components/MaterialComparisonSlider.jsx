import React, { useState } from 'react';

export default function MaterialComparisonSlider({ baselineGrams = 36.3 }) {
  const [currentGrams, setCurrentGrams] = useState(baselineGrams);
  const [pcrPct, setPcrPct] = useState(30);

  const deltaGrams = (currentGrams - baselineGrams).toFixed(1);
  const percentChange = ((deltaGrams / baselineGrams) * 100).toFixed(0);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 my-4">
      <h3 className="text-lg font-semibold text-emerald-900 mb-2">Interactive Material Sandbox</h3>
      <p className="text-sm text-gray-600 mb-4">Drag to simulate weight reduction and PCR integration live against your baseline.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Package Mass: <span className="font-bold text-emerald-700">{currentGrams}g</span> 
            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${deltaGrams <= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {deltaGrams <= 0 ? `${percentChange}% vs baseline` : `+${percentChange}% vs baseline`}
            </span>
          </label>
          <input 
            type="range" min="5" max="80" step="0.5" value={currentGrams} 
            onChange={(e) => setCurrentGrams(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recycled Content (PCR): <span className="font-bold text-emerald-700">{pcrPct}%</span>
          </label>
          <input 
            type="range" min="0" max="100" step="5" value={pcrPct} 
            onChange={(e) => setPcrPct(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}