/**
 * Plugin Builder - AI-Powered Plugin Generation
 *
 * Similar to coding agents like Claude Code or Cursor
 * Generates plugins from natural language descriptions
 */

import { useState, useRef, useEffect } from 'react';
import { usePluginStore } from '@/stores/pluginStore';
import type { PluginManifest } from '@/types/plugin';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface GeneratedPlugin {
  manifest: Partial<PluginManifest>;
  clientCode: string;
  workerCode: string;
  status: 'generating' | 'ready' | 'building' | 'built' | 'deploying' | 'deployed' | 'error';
  error?: string;
  buildOutput?: string;
}

export function PluginBuilder() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'Welcome to the Plugin Builder! Describe what you want your plugin to do, and I\'ll generate the code for you.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlugin, setGeneratedPlugin] = useState<GeneratedPlugin | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'code' | 'manifest' | 'build'>('chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      // Generate plugin code using LLM
      const response = await generatePlugin(input, messages);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.plugin) {
        setGeneratedPlugin(response.plugin);
        setActiveTab('code');
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBuildPlugin = async () => {
    if (!generatedPlugin) return;

    setGeneratedPlugin(prev => prev ? { ...prev, status: 'building' } : null);

    try {
      const buildResult = await buildPlugin(generatedPlugin);

      setGeneratedPlugin(prev => prev ? {
        ...prev,
        status: 'built',
        buildOutput: buildResult.output,
      } : null);

      setActiveTab('build');
    } catch (error) {
      setGeneratedPlugin(prev => prev ? {
        ...prev,
        status: 'error',
        error: (error as Error).message,
      } : null);
    }
  };

  const handleDeployPlugin = async () => {
    if (!generatedPlugin) return;

    setGeneratedPlugin(prev => prev ? { ...prev, status: 'deploying' } : null);

    try {
      await deployPlugin(generatedPlugin);

      setGeneratedPlugin(prev => prev ? { ...prev, status: 'deployed' } : null);

      const successMessage: Message = {
        role: 'assistant',
        content: `✅ Plugin "${generatedPlugin.manifest.name}" deployed successfully! You can now install it from the plugin store.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      setGeneratedPlugin(prev => prev ? {
        ...prev,
        status: 'error',
        error: (error as Error).message,
      } : null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plugin Builder</h1>
            <p className="text-sm text-gray-600">
              AI-powered plugin generation from natural language
            </p>
          </div>

          {generatedPlugin && (
            <div className="flex gap-2">
              {generatedPlugin.status === 'ready' && (
                <button
                  onClick={handleBuildPlugin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  🔨 Build Plugin
                </button>
              )}

              {generatedPlugin.status === 'built' && (
                <button
                  onClick={handleDeployPlugin}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  🚀 Deploy to Registry
                </button>
              )}

              {generatedPlugin.status === 'deployed' && (
                <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                  ✅ Deployed
                </div>
              )}

              {generatedPlugin.status === 'building' && (
                <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">
                  🔄 Building...
                </div>
              )}

              {generatedPlugin.status === 'deploying' && (
                <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                  🔄 Deploying...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-1/2 flex flex-col border-r">
          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.role === 'system'
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-white border text-gray-900'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'Assistant'}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t bg-white p-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Describe your plugin... (e.g., 'Create a plugin that calculates drink prices with custom markup and taxes')"
                className="flex-1 resize-none rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={isGenerating}
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isGenerating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setInput('Create a plugin that calculates drink prices with markup and taxes')}
                className="text-xs px-3 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
              >
                💰 Pricing Calculator
              </button>
              <button
                onClick={() => setInput('Create a plugin that tracks inventory and alerts when stock is low')}
                className="text-xs px-3 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
              >
                📦 Inventory Tracker
              </button>
              <button
                onClick={() => setInput('Create a plugin that generates sales reports by date range')}
                className="text-xs px-3 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
              >
                📊 Sales Reports
              </button>
            </div>
          </div>
        </div>

        {/* Code/Preview Panel */}
        <div className="w-1/2 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b bg-white">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-3 font-medium ${
                activeTab === 'chat'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-4 py-3 font-medium ${
                activeTab === 'code'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={!generatedPlugin}
            >
              💻 Code
            </button>
            <button
              onClick={() => setActiveTab('manifest')}
              className={`px-4 py-3 font-medium ${
                activeTab === 'manifest'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={!generatedPlugin}
            >
              📋 Manifest
            </button>
            <button
              onClick={() => setActiveTab('build')}
              className={`px-4 py-3 font-medium ${
                activeTab === 'build'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={!generatedPlugin}
            >
              🔨 Build
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-gray-900 text-gray-100 p-6">
            {activeTab === 'chat' && (
              <div className="text-center text-gray-400 mt-20">
                <div className="text-6xl mb-4">👋</div>
                <p>Start a conversation to generate your plugin</p>
              </div>
            )}

            {activeTab === 'code' && generatedPlugin && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold mb-2 text-white">Client Code (Rust)</h3>
                  <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{generatedPlugin.clientCode}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-2 text-white">Worker Code (Rust)</h3>
                  <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{generatedPlugin.workerCode}</code>
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'manifest' && generatedPlugin && (
              <div>
                <h3 className="text-lg font-bold mb-2 text-white">Plugin Manifest</h3>
                <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{JSON.stringify(generatedPlugin.manifest, null, 2)}</code>
                </pre>
              </div>
            )}

            {activeTab === 'build' && generatedPlugin && (
              <div>
                <h3 className="text-lg font-bold mb-2 text-white">Build Output</h3>
                <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                  <code>{generatedPlugin.buildOutput || 'No build output yet'}</code>
                </pre>

                {generatedPlugin.error && (
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded-lg">
                    <h4 className="font-bold text-red-400 mb-2">Error</h4>
                    <pre className="text-red-300 text-sm">{generatedPlugin.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate plugin code using LLM
 */
async function generatePlugin(userRequest: string, conversationHistory: Message[]) {
  // TODO: Integrate with Claude API or other LLM
  // For now, return a mock response

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const pluginId = userRequest.toLowerCase().replace(/\s+/g, '-').slice(0, 20);

  const plugin: GeneratedPlugin = {
    manifest: {
      id: pluginId,
      name: userRequest.split(' ').slice(0, 3).join(' '),
      version: '1.0.0',
      description: `Generated plugin: ${userRequest}`,
      author: 'Plugin Builder',
      type: 'hybrid',
      visibility: 'public',
      target: {
        client: true,
        worker: true,
      },
      requires_app_version: '>=3.0.0',
      requires_permissions: ['storage.*', 'database.read.*'],
    },
    clientCode: `// Generated client plugin for: ${userRequest}
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init(_context: &str, _host: &str) -> Result<(), JsValue> {
    Ok(())
}

// Add your plugin logic here
`,
    workerCode: `// Generated worker plugin for: ${userRequest}

#[no_mangle]
pub extern "C" fn init() -> i32 {
    0
}

// Add your plugin logic here
`,
    status: 'ready',
  };

  return {
    message: `I've generated a starter plugin for "${userRequest}". You can now review the code, build it, and deploy it to your registry.`,
    plugin,
  };
}

/**
 * Build plugin (compile Rust to WASM)
 */
async function buildPlugin(plugin: GeneratedPlugin) {
  // TODO: Implement build service
  // This would need to:
  // 1. Create temp directory
  // 2. Write Rust code to files
  // 3. Run cargo build --target wasm32-unknown-unknown
  // 4. Return compiled WASM files

  await new Promise(resolve => setTimeout(resolve, 3000));

  return {
    output: `Building plugin "${plugin.manifest.name}"...
✅ Client plugin compiled successfully
✅ Worker plugin compiled successfully
📦 Total size: 45KB
`,
  };
}

/**
 * Deploy plugin to registry
 */
async function deployPlugin(plugin: GeneratedPlugin) {
  // TODO: Implement deployment
  // This would:
  // 1. Upload WASM files to R2
  // 2. Update KV registry
  // 3. Generate checksums

  await new Promise(resolve => setTimeout(resolve, 2000));
}
