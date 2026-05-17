import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { settingsStore } from '../lib/db';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  onClose: () => void;
  onSettingsSaved: () => void;
}

export interface AppSettings {
  openaiBaseUrl: string;
  openaiKey: string;
  openaiKeys?: string[];
  customModels: { id: string; name: string }[];
}

export function SettingsModal({ onClose, onSettingsSaved }: SettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiKey: '',
    openaiKeys: [''],
    customModels: []
  });
  const [message, setMessage] = useState<{ type: 'success'|'error', text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const saved = await settingsStore.getItem<AppSettings>('app_settings');
      if (saved) {
        const openaiKeys = saved.openaiKeys && saved.openaiKeys.length > 0
          ? saved.openaiKeys
          : saved.openaiKey ? [saved.openaiKey] : [''];
        setSettings({ ...saved, openaiKeys });
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const validKeys = (settings.openaiKeys || []).filter(k => k.trim() !== '');
      const finalKeys = validKeys.length > 0 ? validKeys : [''];
      const toSave = {
        ...settings,
        openaiKeys: finalKeys,
        openaiKey: finalKeys[0]
      };
      await settingsStore.setItem('app_settings', toSave);
      setSettings(toSave);
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
      onSettingsSaved();
      setTimeout(onClose, 1000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchModels = async () => {
    const validKeys = (settings.openaiKeys || []).filter(k => k.trim() !== '');
    const keyToUse = validKeys.length > 0 ? validKeys[0] : settings.openaiKey;
    if (!settings.openaiBaseUrl || !keyToUse) {
      setMessage({ type: 'error', text: 'Base URL and at least one API Key are required to fetch models.' });
      return;
    }

    setFetchingModels(true);
    setMessage(null);
    try {
      const url = settings.openaiBaseUrl.endsWith('/') 
        ? `${settings.openaiBaseUrl}models` 
        : `${settings.openaiBaseUrl}/models`;

      // Depending on CORS, this might fail from browser without a proxy if the custom API doesn't support it, but we try anyway since it's a "custom" endpoint often hosted by user with cors enabled or through a local proxy.
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => ({
          id: m.id,
          name: m.id // some endpoints don't provide a nice name
        }));
        setSettings(s => ({ ...s, customModels: models }));
        setMessage({ type: 'success', text: `Fetched ${models.length} models successfully.` });
      } else {
        throw new Error('Unexpected response format.');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to fetch models.' });
    } finally {
      setFetchingModels(false);
    }
  };

  const addApiKey = () => {
    setSettings(s => ({ ...s, openaiKeys: [...(s.openaiKeys || []), ''] }));
  };

  const updateApiKey = (index: number, value: string) => {
    setSettings(s => {
      const newKeys = [...(s.openaiKeys || [])];
      newKeys[index] = value;
      return { ...s, openaiKeys: newKeys };
    });
  };

  const removeApiKey = (index: number) => {
    setSettings(s => {
      const newKeys = [...(s.openaiKeys || [])];
      newKeys.splice(index, 1);
      if (newKeys.length === 0) newKeys.push('');
      return { ...s, openaiKeys: newKeys };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-inter">
        <div className="flex items-center justify-between p-6 border-b border-divider">
          <h2 className="font-playfair text-xl font-bold text-ink">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors text-accent hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {message && (
            <div className={cn("px-4 py-3 rounded text-sm", message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-ink mb-1">Custom OpenAI Endpoint</h3>
              <p className="text-xs text-accent mb-4">Connect to any OpenAI-compatible API (e.g., DeepSeek, Groq, Ollama, vLLM).</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Base URL</label>
              <input 
                type="text" 
                value={settings.openaiBaseUrl}
                onChange={e => setSettings(s => ({...s, openaiBaseUrl: e.target.value}))}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 border border-divider rounded-md focus:outline-none focus:border-ink transition-colors text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink">API Keys (Load Balanced)</label>
              <div className="space-y-2">
                {(settings.openaiKeys || []).map((key, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="password"
                      value={key}
                      onChange={e => updateApiKey(idx, e.target.value)}
                      placeholder="sk-..."
                      className="flex-1 px-3 py-2 border border-divider rounded-md focus:outline-none focus:border-ink transition-colors text-sm"
                    />
                    <button onClick={() => removeApiKey(idx)} className="p-2 text-accent hover:text-red-500 transition-colors" title="Remove Key">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addApiKey}
                className="flex items-center gap-1 text-sm font-medium text-ink hover:text-black transition-colors"
              >
                <Plus className="w-4 h-4" /> Add API Key
              </button>
            </div>

            <div className="pt-2">
              <button 
                onClick={handleFetchModels}
                disabled={fetchingModels}
                className="flex items-center gap-2 px-4 py-2 border border-divider rounded-md text-sm font-medium hover:bg-black/5 transition-colors disabled:opacity-50"
              >
                {fetchingModels ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Fetch Models
              </button>
            </div>

            {settings.customModels.length > 0 && (
              <div className="mt-4">
                <label className="text-sm font-medium text-ink mb-2 block">Available Custom Models ({settings.customModels.length})</label>
                <div className="max-h-32 overflow-y-auto border border-divider rounded-md bg-paper p-2">
                  <ul className="text-xs text-accent space-y-1">
                    {settings.customModels.map(m => (
                      <li key={m.id} className="truncate px-2 py-1 hover:bg-black/5 rounded">{m.id}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-divider flex justify-end gap-3 bg-paper/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-divider rounded-md text-sm font-medium hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-ink text-white rounded-md text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
