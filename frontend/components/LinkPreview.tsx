"use client";

import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';

interface LinkPreviewProps {
    preview: {
        title?: string;
        description?: string;
        image?: string;
        siteName?: string;
        url: string;
    };
    theme?: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ preview, theme }) => {
    const isIncognito = theme === 'incognito';
    const isUbuntu = theme === 'ubuntu';

    if (isIncognito) {
        return (
            <div className="mt-2 mb-1 p-2 border border-[#3c3c3c] bg-[#252526] rounded-sm font-mono text-[12px]">
                <div className="text-[#6a9955] mb-1">/** Link Preview */</div>
                <div className="flex gap-3">
                    {preview.image && (
                        <div className="w-16 h-16 flex-shrink-0 border border-[#3c3c3c]">
                            <img src={preview.image} alt="" className="w-full h-full object-cover opacity-80" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="text-[#4ec9b0] truncate">{preview.title || 'No Title'}</div>
                        <div className="text-[#ce9178] line-clamp-2 mt-0.5">{preview.description}</div>
                        <div className="text-[#858585] mt-1 flex items-center gap-1">
                            <Globe size={10} /> <span>{preview.siteName || new URL(preview.url).hostname}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isUbuntu) {
        return (
            <div className="mt-2 mb-2 p-3 border border-[#541d66] bg-[#3c1f4a]/30 rounded font-mono text-[13px]">
                <div className="text-[#a8cc8c] mb-1">$ curl -I {new URL(preview.url).hostname}</div>
                <div className="text-[#f0f0f0] font-bold">{preview.title}</div>
                <div className="text-[#6e6e6e] mt-1 italic">{preview.description}</div>
                {preview.image && (
                    <div className="mt-2 border border-[#541d66] opacity-70">
                        <img src={preview.image} alt="" className="max-h-32 w-auto object-contain" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 mb-1 bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl overflow-hidden transition-all duration-200 group/preview"
        >
            <div className="flex flex-col">
                {preview.image && (
                    <div className="w-full h-40 overflow-hidden border-b border-white/5">
                        <img
                            src={preview.image}
                            alt=""
                            className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-500"
                        />
                    </div>
                )}
                <div className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-white/10 p-1 rounded">
                            <Globe size={12} className="text-[var(--color-brand-primary)]" />
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                            {preview.siteName || new URL(preview.url).hostname}
                        </span>
                    </div>
                    <h4 className="text-white font-semibold text-sm line-clamp-1 mb-1 group-hover/preview:text-[var(--color-brand-primary)] transition-colors">
                        {preview.title}
                    </h4>
                    <p className="text-white/60 text-xs line-clamp-2 leading-relaxed">
                        {preview.description}
                    </p>
                </div>
            </div>
        </a>
    );
};
