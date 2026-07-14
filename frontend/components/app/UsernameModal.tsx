"use client";

import { useState } from "react";
import { X, User, Check } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { cli } from "@/lib/cli";

interface UsernameModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UsernameModal({ open, onClose }: UsernameModalProps) {
  const [username, setUsername] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCurrentName = async () => {
    try {
      const info = await cli.account.info();
      if (info && typeof info === 'object' && 'name' in info) {
        setUsername(String(info.name || 'Employee'));
      }
    } catch (e) {
      console.error("[UsernameModal] Failed to fetch:", e);
    }
  };

  if (open && !username) {
    fetchCurrentName();
  }

  const handleSave = async () => {
    setLoading(true);
    try {
      await cli.username.set(username);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (e) {
      console.error("[UsernameModal] Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUsername("");
    setSaved(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      maxWidth="max-w-sm"
      ariaLabelledBy="username-modal-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-md text-brand-muted hover:text-brand-navy hover:bg-brand-light transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-brand-blue/10 text-brand-blue">
            <User size={18} />
          </span>
          <h2
            id="username-modal-title"
            className="text-lg font-light text-brand-navy leading-tight m-0"
          >
            Change Username
          </h2>
        </div>

        <label htmlFor="username-input" className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1.5">
          Display Name
        </label>
        <input
          id="username-input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Your name for team chat..."
          className="w-full rounded-md border border-gray-200 bg-white py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none mb-4"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saved}
            className="inline-flex items-center justify-center gap-1.5 flex-1 py-2.5 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saved ? <><Check size={14} /> Saved</> : "Save"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center py-2.5 px-4 bg-white border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase text-brand-navy hover:bg-brand-light transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
