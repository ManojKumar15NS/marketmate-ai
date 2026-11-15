import React, { useState } from 'react';
import {
  X,
  MapPin,
  ExternalLink,
  Star,
  Clock,
  Globe,
  Phone,
  Copy,
  Check,
  Users
} from 'lucide-react';
import { WhatsAppLead } from '../types';

interface CompanyDetailModalProps {
  lead: WhatsAppLead;
  onClose: () => void;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({ lead, onClose }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const mapsUrl =
    lead.googleProfileUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${lead.businessName} ${lead.address || lead.locality || lead.city}`
    )}`;

  const cleanWebsite = lead.website
    ? lead.website.startsWith('http')
      ? lead.website
      : `https://${lead.website}`
    : null;

  const phoneItems =
    lead.phones && lead.phones.length > 0
      ? lead.phones.map((p, idx) => ({
          id: `p_${idx}`,
          number: p.e164Number || p.originalNumber,
          isMobile: p.lineType === 'mobile',
          whatsappUrl: p.whatsappUrl || lead.whatsappUrl
        }))
      : [
          {
            id: 'p_primary',
            number: lead.phoneInternational || lead.phoneRaw,
            isMobile: lead.isMobile,
            whatsappUrl: lead.whatsappUrl
          }
        ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-snug">{lead.businessName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {lead.brandName && lead.brandName !== lead.businessName && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  Brand: {lead.brandName}
                </span>
              )}
              <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                {lead.category || 'Business'}
              </span>
              <span className="text-xs font-semibold text-gray-700">
                Lead Score: {lead.scores?.totalScore || 75}/100
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* SECTION 1: Google Maps Listing & Physical Location */}
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-red-500" />
                <span>Google Maps Details & Location</span>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
              </a>
            </div>

            <div className="text-xs text-gray-800 leading-relaxed font-medium">{lead.address}</div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-blue-100 text-xs">
              {lead.rating && (
                <div className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>Google Rating: {lead.rating}</span>
                </div>
              )}

              {lead.operatingHours && (
                <div className="flex items-center gap-1.5 text-gray-700 font-medium bg-white px-2 py-1 rounded border border-gray-200">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span>{lead.operatingHours}</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Official Website & Online Presence */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-gray-500" />
              <span>Website & Online Presence</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="text-gray-600">
                {cleanWebsite ? (
                  <span className="font-semibold text-gray-800">{lead.website}</span>
                ) : (
                  <span className="text-gray-400">No official website listed</span>
                )}
              </div>
              {cleanWebsite && (
                <a
                  href={cleanWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
                >
                  <span>Visit Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {lead.linkedinUrl && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-600">LinkedIn Company Page</span>
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  View LinkedIn Profile ↗
                </a>
              </div>
            )}
          </div>

          {/* SECTION 3: All Phone Numbers & WhatsApp */}
          <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-2.5">
            <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Contact Phone Numbers ({phoneItems.length})</span>
            </div>

            <div className="divide-y divide-emerald-100/60">
              {phoneItems.map((phone) => {
                if (!phone.number) return null;
                return (
                  <div key={phone.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{phone.number}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          phone.isMobile ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {phone.isMobile ? 'Mobile (WhatsApp Ready)' : 'Landline / Reception'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(phone.number, phone.id)}
                        className="px-2 py-1 text-xs text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition"
                      >
                        {copiedId === phone.id ? 'Copied' : 'Copy'}
                      </button>

                      {phone.isMobile && phone.whatsappUrl && (
                        <a
                          href={phone.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: Authorized Decision-Makers */}
          <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-100 space-y-3">
            <div className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Authorized Decision-Makers ({lead.decisionMakers?.length || 0})</span>
            </div>

            {lead.decisionMakers && lead.decisionMakers.length > 0 ? (
              <div className="divide-y divide-purple-100">
                {lead.decisionMakers.map((dm) => (
                  <div key={dm.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-gray-900">{dm.name}</span>
                        <span className="text-purple-700 font-medium ml-1.5">• {dm.designation}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                        {dm.roleCategory}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-gray-500 pt-0.5">
                      <span className="text-emerald-700 font-medium">Status: {dm.employmentStatus}</span>
                      {dm.email && (
                        <a href={`mailto:${dm.email}`} className="text-blue-600 hover:underline">
                          {dm.email}
                        </a>
                      )}
                      {dm.linkedinUrl && (
                        <a href={dm.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          LinkedIn ↗
                        </a>
                      )}
                    </div>

                    {dm.sourceEvidence && (
                      <div className="text-[11px] text-gray-600 italic mt-1 bg-white p-1.5 rounded border border-gray-100">
                        Evidence: {dm.sourceEvidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                No specific leadership profiles discovered for this branch yet. You can outreach through reception or the company website.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
