'use client';

import React, { useState } from 'react';

interface TransactionTagsProps {
  tags?: string;
  transactionId: number;
  onAddTag: (transactionId: number, tag: string) => Promise<void>;
  onRemoveTag: (transactionId: number, tag: string) => Promise<void>;
  allTags: string[];
}

export default function TransactionTags({ tags, transactionId, onAddTag, onRemoveTag, allTags }: TransactionTagsProps) {
  const [showInput, setShowInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  const tagList = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
  
  const handleAddTag = async (tag: string) => {
    if (!tag.trim()) return;
    
    await onAddTag(transactionId, tag.trim());
    setNewTag('');
    setShowInput(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag(newTag);
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setNewTag('');
    }
  };
  
  return (
    <div className="flex items-center flex-wrap gap-1">
      {tagList.map((tag, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-bitcoin/10 text-bitcoin text-xs rounded-full border border-bitcoin/20"
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTag(transactionId, tag);
            }}
            className="hover:text-loss transition-colors"
            title="Remove tag"
          >
            ×
          </button>
        </span>
      ))}
      
      {showInput ? (
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (newTag.trim()) {
              handleAddTag(newTag);
            } else {
              setShowInput(false);
            }
          }}
          placeholder="Tag name..."
          autoFocus
          className="w-20 px-2 py-0.5 text-xs border border-bitcoin/30 rounded bg-btc-bg-tertiary text-btc-text-primary focus:outline-none focus:ring-1 focus:ring-bitcoin"
        />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowInput(true);
          }}
          className="text-xs text-btc-text-muted hover:text-bitcoin transition-colors"
          title="Add tag"
        >
          + tag
        </button>
      )}
    </div>
  );
}


