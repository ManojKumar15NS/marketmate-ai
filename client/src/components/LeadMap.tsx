import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Lead } from '../types';

interface LeadMapProps {
  leads: Lead[];
  selectedLeadId?: string;
  onSelectLead: (lead: Lead) => void;
  center?: { lat: number; lng: number };
}

export const LeadMap: React.FC<LeadMapProps> = ({
  leads,
  selectedLeadId,
  onSelectLead,
  center = { lat: 46.6021, lng: -120.5059 }
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if not yet created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: 9,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    const validLeads = leads.filter(l => l.coordinates && l.coordinates.lat && l.coordinates.lng);
    const bounds: L.LatLngBounds = L.latLngBounds([]);

    validLeads.forEach(lead => {
      const { lat, lng } = lead.coordinates!;
      const isSelected = lead.id === selectedLeadId;

      // Custom SVG marker pin
      const pinColor = lead.fitScore >= 80 ? '#16a34a' : lead.fitScore >= 65 ? '#2563eb' : '#d97706';
      const iconHtml = `
        <div style="
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background-color: ${isSelected ? '#0f172a' : pinColor};
          border: 3px solid #ffffff;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 11px;
          cursor: pointer;
        ">
          ${lead.fitScore}%
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-map-pin',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      const dm = lead.decisionMakers?.[0] || { name: 'Operations Lead', title: 'Manager' };
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 200px; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #0f172a;">${lead.companyName}</h4>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">${lead.industry}</p>
          <p style="margin: 0 0 6px 0; font-size: 11px; color: #334155;">📍 ${lead.address || lead.location} ${lead.distanceMiles ? `(${lead.distanceMiles} mi)` : ''}</p>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;">
            <p style="margin: 0; font-size: 11px; font-weight: 600; color: #1e293b;">👤 ${dm.name} <span style="font-weight: normal; color: #64748b;">(${dm.title})</span></p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #0284c7;">✉️ ${dm.email || 'Sequential cascade active'}</p>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        onSelectLead(lead);
      });

      markersRef.current[lead.id] = marker;
      bounds.extend([lat, lng]);
    });

    // Auto-fit bounds if markers exist
    if (validLeads.length > 0 && map) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [leads, selectedLeadId, center]);

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-200 shadow-sm z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 shadow-sm flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
        <span>80%+ Fit</span>
        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block ml-1" />
        <span>65%+ Fit</span>
        <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block ml-1" />
        <span>&lt;65%</span>
      </div>
    </div>
  );
};
export default LeadMap;
