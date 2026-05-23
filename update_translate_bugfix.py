import re

with open('src/routes/api/translate/+server.ts', 'r') as f:
    content = f.read()

# Fix Gemini loop bug
old_gemini_catch = """        } catch (error: any) {
            if (retries === 0) {
                throw error;
            }
            console.warn(`Gemini API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay = Math.min(delay * 2, maxDelay);
        }"""
new_gemini_catch = """        } catch (error: any) {
            if (retries === 1) {
                throw error;
            }
            console.warn(`Gemini API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries - 1})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay = Math.min(delay * 2, maxDelay);
        }"""

content = content.replace(old_gemini_catch, new_gemini_catch)

with open('src/routes/api/translate/+server.ts', 'w') as f:
    f.write(content)
