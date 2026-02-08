'use client';
import { useState } from 'react';
import { Rocket, Bot, Server, CloudLightning, Cpu, Key, MessageCircle, Smartphone, ArrowRight } from 'lucide-react';

export default function Wizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  
  const [formData, setFormData] = useState({
    agentName: '',
    provider: 'localclaw',
    apiKey: '',
    telegramToken: '',
    whatsappToken: ''
  });

  const handleDeploy = async () => {
    setLoading(true);
    const agentId = (formData.agentName || 'agent').toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 1000);

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentId,
          provider: formData.provider,
          apiKey: formData.apiKey,
          // PASS CHANNELS TO BACKEND
          channels: {
            telegram: formData.telegramToken,
            whatsapp: formData.whatsappToken
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setResultUrl(data.dashboardUrl);
        setStep(3); // Success Screen
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Deployment Failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-600 rounded-lg"><Bot className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">OpenClaw Deployer</h1>
            <p className="text-neutral-400 text-sm">Step {step} of 3: {step === 1 ? ' Intelligence' : step === 2 ? ' Connections' : ' Deployed'}</p>
          </div>
        </div>

        {/* STEP 1: THE BRAIN */}
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">Agent Name</label>
              <input 
                value={formData.agentName}
                onChange={e => setFormData({...formData, agentName: e.target.value})}
                className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 focus:border-blue-500 outline-none"
                placeholder="e.g. bot"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
               {/* Provider Cards (Same as before) */}
               <button onClick={() => setFormData({...formData, provider: 'localclaw'})}
                  className={`p-4 rounded-xl border text-left transition ${formData.provider === 'localclaw' ? 'bg-blue-600/20 border-blue-500' : 'bg-neutral-800 border-neutral-700'}`}>
                  <Server className="w-6 h-6 mb-2 text-emerald-400" /><div className="font-bold">LocalClaw</div>
               </button>
               <button onClick={() => setFormData({...formData, provider: 'openai'})}
                  className={`p-4 rounded-xl border text-left transition ${formData.provider === 'openai' ? 'bg-blue-600/20 border-blue-500' : 'bg-neutral-800 border-neutral-700'}`}>
                  <CloudLightning className="w-6 h-6 mb-2 text-green-400" /><div className="font-bold">OpenAI</div>
               </button>
               <button onClick={() => setFormData({...formData, provider: 'gemini'})}
                  className={`p-4 rounded-xl border text-left transition ${formData.provider === 'gemini' ? 'bg-blue-600/20 border-blue-500' : 'bg-neutral-800 border-neutral-700'}`}>
                  <Cpu className="w-6 h-6 mb-2 text-purple-400" /><div className="font-bold">Gemini</div>
               </button>
            </div>

            {formData.provider !== 'localclaw' && (
              <div>
                <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">API Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-5 h-5 text-neutral-500" />
                  <input type="password" value={formData.apiKey} onChange={e => setFormData({...formData, apiKey: e.target.value})}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 pl-10 focus:border-blue-500 outline-none" placeholder="sk-..." />
                </div>
              </div>
            )}

            <button onClick={() => setStep(2)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition flex items-center justify-center gap-2">
              Next Step <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* STEP 2: CHANNELS (Optional) */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-sm text-neutral-400">
              Optional: Connect your agent to messaging apps. Leave blank to skip.
            </div>

            <div>
              <label className="block text-xs uppercase text-neutral-500 font-bold mb-2 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-400"/> Telegram Bot Token
              </label>
              <input 
                value={formData.telegramToken}
                onChange={e => setFormData({...formData, telegramToken: e.target.value})}
                className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 focus:border-blue-500 outline-none font-mono text-sm"
                placeholder="123456:ABC-Def..."
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-neutral-500 font-bold mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-green-400"/> WhatsApp / Twilio Token
              </label>
              <input 
                value={formData.whatsappToken}
                onChange={e => setFormData({...formData, whatsappToken: e.target.value})}
                className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 focus:border-blue-500 outline-none font-mono text-sm"
                placeholder="Auth Token (Meta/Twilio)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="px-6 py-4 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold transition">
                Back
              </button>
              <button onClick={handleDeploy} disabled={loading} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition flex items-center justify-center gap-2">
                {loading ? <span className="animate-pulse">Deploying...</span> : <><Rocket className="w-5 h-5"/> Launch Agent</>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS (Same as before) */}
        {step === 3 && (
           <div className="text-center space-y-8 py-8 animate-in zoom-in duration-300">
             <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
               <Rocket className="w-10 h-10" />
             </div>
             <h2 className="text-3xl font-bold text-white">Agent Live!</h2>
             <a href={resultUrl} target="_blank" className="block w-full py-4 bg-white text-black font-bold text-lg rounded-xl hover:bg-gray-200 transition">
               Open Dashboard ↗
             </a>
           </div>
        )}

      </div>
    </div>
  );
}