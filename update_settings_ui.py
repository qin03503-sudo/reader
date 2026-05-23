import re

with open('src/lib/components/SettingsModal.svelte', 'r') as f:
    content = f.read()

# Update initial state
state_match = re.search(r"let settings = \$state\(\{.*?defaultModel: 'gemini-2.5-flash'\n\s+\}\);", content, re.DOTALL)
if state_match:
    old_state = state_match.group(0)
    new_state = old_state.replace(
        "defaultModel: 'gemini-2.5-flash'\n  });",
        "defaultModel: 'gemini-2.5-flash',\n    maxRetries: 3,\n    baseDelay: 2000,\n    maxDelay: 30000,\n    concurrencyLimit: 5\n  });"
    )
    content = content.replace(old_state, new_state)

# Update onMount
onmount_match = re.search(r"if \(!settings.defaultModel\) settings.defaultModel = 'gemini-2.5-flash';", content)
if onmount_match:
    old_onmount = onmount_match.group(0)
    new_onmount = old_onmount + "\n      if (settings.maxRetries === undefined) settings.maxRetries = 3;\n      if (settings.baseDelay === undefined) settings.baseDelay = 2000;\n      if (settings.maxDelay === undefined) settings.maxDelay = 30000;\n      if (settings.concurrencyLimit === undefined) settings.concurrencyLimit = 5;"
    content = content.replace(old_onmount, new_onmount)

# Add new inputs to UI
ui_insertion_point = "<!-- Custom OpenAI -->"
new_ui = """
        <!-- Advanced Translation Settings -->
        <div class="space-y-4 bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm">
          <h3 class="font-semibold text-lg text-gray-900">Advanced API Settings</h3>
          <p class="text-sm text-gray-500 mb-2">Configure retry logic and concurrency for API calls.</p>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5" for="maxRetries">
                Max Retries
              </label>
              <input
                id="maxRetries"
                type="number"
                min="0"
                bind:value={settings.maxRetries}
                class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5" for="concurrencyLimit">
                Concurrency Limit
              </label>
              <input
                id="concurrencyLimit"
                type="number"
                min="1"
                bind:value={settings.concurrencyLimit}
                class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5" for="baseDelay">
                Base Delay (ms)
              </label>
              <input
                id="baseDelay"
                type="number"
                min="100"
                step="100"
                bind:value={settings.baseDelay}
                class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5" for="maxDelay">
                Max Delay (ms)
              </label>
              <input
                id="maxDelay"
                type="number"
                min="1000"
                step="1000"
                bind:value={settings.maxDelay}
                class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
              />
            </div>
          </div>
        </div>

        <!-- Custom OpenAI -->"""

content = content.replace("<!-- Custom OpenAI -->", new_ui)

with open('src/lib/components/SettingsModal.svelte', 'w') as f:
    f.write(content)
