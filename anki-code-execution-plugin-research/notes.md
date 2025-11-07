# Anki Code Execution Plugin Research Notes

## Research Goal
Investigate if it's possible to build an Anki plugin that supports code execution for practicing coding with predefined test cases, and check if such a plugin already exists.

## Investigation Timeline

### Initial Research Phase

#### Existing Solutions Found

**AnkiCode - A Standalone Application**
- URL: https://ankicode.app/ and https://daveight.github.io/ankicode/
- GitHub: https://github.com/daveight/ankicode
- Type: Modified/forked version of Anki (standalone application, not a plugin)
- Developer: daveight

Key Features:
- "Programming Challenge" card type that allows writing and executing code directly in the app
- Supported languages: C++, Kotlin, Java, JavaScript, and Python
- Code execution runtime is bundled inside the app - code runs locally
- Integrated code editor with syntax highlighting and theme selection
- Platforms: Windows 10/11, Mac OS Intel, Mac OS ARM
- Pre-made decks based on LeetCode problems and "Elements of Programming Interviews" book
- Deck repository: https://github.com/daveight/ankicode-decks

#### Other Related Projects (No Code Execution)

**Code Display Templates (not execution):**
- badlydrawnrob/anki: Flashcard templates for displaying code with syntax highlighting
- anki-code-highlighter: Anki plugin for code syntax highlighting only
- Various LeetCode Anki deck generators (static cards, no execution)

**Interactive Coding (External to Anki):**
- donnemartin/interactive-coding-challenges: Jupyter notebooks with unit tests + Anki flashcards (separate systems)
- Code Cards website: Alternative to Anki with code editor, but not an Anki plugin

### Anki Plugin Architecture Research

#### What Anki Addons Can Do

**Technical Foundation:**
- Addons are Python modules loaded at startup
- Official documentation: https://addon-docs.ankiweb.net/
- Addons can use hooks, modify UI, access the Anki API
- Full access to Python's capabilities, including subprocess

**Card Templates:**
- Card templates support JavaScript execution
- Cards are rendered as webpages (Chromium engine on desktop, Safari on mobile)
- JavaScript in templates is NOT officially supported by Anki
- JS executes every time card is rendered (front and back may differ)
- No persistent storage in window.py object in Anki 2.1+

**Custom Card Types:**
- Can create custom card types with HTML/CSS/JavaScript
- Templates can include external JS/CSS files
- JavaScript has limitations and platform differences

#### Security Considerations for Code Execution

**Python Sandboxing Challenges:**
- Pure Python sandboxing is extremely difficult
- Python's introspection allows many escape routes
- Python's audit hooks "not suitable for implementing a sandbox"
- Malicious code can trivially disable or bypass Python-based sandboxes

**Recommended Approaches:**
1. **OS-Level Sandboxing:**
   - AppArmor (used by CodeJail project)
   - seccomp (secure computing mode)

2. **Process Isolation:**
   - Run code in separate processes with restricted privileges
   - Use subprocess module with careful privilege management

3. **Container-Based:**
   - Docker containers
   - Virtual machines

4. **Language-Specific Sandboxes:**
   - PyPy sandbox mode (marshals operations to stdout/stdin)
   - Language-specific execution environments

### Code Execution Approaches for Anki Plugin

#### Browser-Based Execution (Recommended for Plugin)

**Pyodide (Python in Browser via WebAssembly):**
- URL: https://pyodide.org/
- GitHub: https://github.com/pyodide/pyodide
- Runs Python directly in the browser without backend server
- Compiles CPython to WebAssembly
- Excellent sandboxing properties (isolated from host system)
- Includes popular libraries: NumPy, Pandas, Matplotlib
- Package installation via micropip
- Used by JupyterLite and educational platforms
- Perfect for Anki card templates since cards render as webpages
- Security: Code runs in browser sandbox, can't access file system or network (without permission)

**Other WebAssembly Options:**
- WASM compilers for C++, Rust, Go, etc.
- JavaScript execution (native to browser, already available in Anki)

#### Server-Based Execution (Not Suitable for Plugin)

**Remote Code Execution Services:**
- Judge0, Piston, Repl.it API, etc.
- Requires internet connection
- Not suitable for offline Anki usage
- Privacy concerns (code sent to third-party servers)

#### Local Execution via Addon (More Complex)

**Subprocess Approach:**
- Python addon could spawn subprocesses to run code
- Would need language runtimes installed (Python, Java, etc.)
- Security concerns: harder to sandbox properly
- Would work for desktop only (not AnkiWeb, AnkiMobile)
- Similar to what AnkiCode does but requires bundling runtimes

**Docker/Container Approach:**
- Most secure for arbitrary code execution
- Requires Docker installed
- Heavy weight solution
- Desktop only
- Overkill for flashcard application

### Feasibility Assessment

#### Is it Possible? YES

**Three viable approaches:**

1. **Browser-Based with Pyodide (MOST FEASIBLE)**
   - Embed Pyodide in card templates
   - Add CodeMirror or Monaco Editor for code editing
   - Run Python code directly in browser when reviewing cards
   - Test cases can be JavaScript functions that call Python code
   - Works on Desktop, AnkiWeb, and potentially AnkiMobile
   - Security: Browser sandbox provides good isolation
   - No addon required - just card templates!
   - Similar approach demonstrated at https://krmanik.github.io/create-anki-addon-browser/

2. **Addon with Custom Card Type (MODERATE COMPLEXITY)**
   - Create Python addon that adds custom card type
   - Use Pyodide in card template + Python addon for additional features
   - Could add test runner UI, statistics, progress tracking
   - Still browser-based execution for cross-platform compatibility

3. **Desktop-Only with Subprocess (COMPLEX, LIMITED)**
   - Fork AnkiCode or build similar addon
   - Bundle language runtimes
   - Desktop only, large download size
   - More complex development and maintenance

#### Recommended Approach: Pyodide + Custom Card Template

**Why this works best:**
- No need to bundle language runtimes
- Works across all Anki platforms
- Secure (browser sandbox)
- Can be distributed as simple card template or minimal addon
- Users can create their own programming practice cards
- Similar to how AnkiCode works but browser-based instead

**Existing Components to Leverage:**
- CodeMirror Anki addon (https://github.com/liwoe/anki-codemirror) - for code editing in card creation
- Pyodide - for Python execution in browser
- Monaco Editor or CodeMirror in templates - for in-card code editing
- JavaScript for test case validation

### Proof of Concept Created

Created `proof-of-concept.html` demonstrating:
- Pyodide loading and initialization
- Code editor (textarea, could be upgraded to CodeMirror/Monaco)
- "Run Code" button to execute user's Python code
- "Run Tests" button to validate against predefined test cases
- Test case framework with pass/fail indicators
- Hint system (typical for spaced repetition learning)
- All runs in browser, no server needed

This POC proves the concept is viable and could be packaged as an Anki card template.

### Implementation Considerations

#### For Card Template Approach:

**Pros:**
- No addon installation required
- Works on all platforms (Desktop, Web, Mobile with modern browsers)
- Easy to share - just export/import deck
- Users can modify card templates to fit their needs
- Secure - browser sandbox

**Cons:**
- Pyodide is ~10-30MB download per card view (can be cached)
- Initial load time (2-10 seconds depending on connection)
- Limited to languages with WebAssembly support (Python, C++, Rust, etc.)
- Need to load Pyodide from CDN or bundle it

**Optimizations:**
- Cache Pyodide in localStorage or service worker
- Load Pyodide once at session start using addon hook
- Pre-load commonly used packages

#### For Addon Approach:

**Pros:**
- Can pre-load Pyodide once per session
- Better performance - shared runtime across cards
- Can add UI features: progress tracking, statistics, deck generation tools
- Can integrate with CodeMirror for better editing experience
- Could support multiple languages via different WebAssembly runtimes

**Cons:**
- Requires addon installation
- More complex development
- Need to maintain addon compatibility with Anki versions
- Still need WebAssembly support in browser

#### Technical Challenges:

1. **Loading Time:**
   - Pyodide is large (~10-30MB)
   - First load takes several seconds
   - Solution: Pre-load at session start, cache aggressively

2. **AnkiMobile Compatibility:**
   - Uses Safari WebView
   - WebAssembly support should work but needs testing
   - May have memory limitations

3. **Offline Usage:**
   - Need to bundle Pyodide locally or ensure CDN caching
   - Service workers could help

4. **Multiple Languages:**
   - Python works well with Pyodide
   - JavaScript works natively
   - C++, Rust need additional WASM compilation
   - Java, Kotlin would need JVM in WASM (complex)

5. **Package Support:**
   - Pure Python packages work via micropip
   - Packages with C extensions need WebAssembly compilation
   - Not all packages available

### Comparison with AnkiCode

| Feature | AnkiCode | Proposed Solution |
|---------|----------|-------------------|
| Architecture | Forked Anki app | Card template or addon |
| Code Execution | Bundled runtimes | Browser (WebAssembly) |
| Languages | C++, Java, JS, Python, Kotlin | Python (+ other WASM langs) |
| Platform Support | Desktop only | Desktop + Web + Mobile |
| Download Size | 383MB - 1.3GB | ~10-30MB (Pyodide) |
| Installation | Separate app | Cards or addon |
| Maintenance | Fork must track Anki updates | Works with standard Anki |
| Offline | Yes | Yes (with caching) |
| Security | OS-level isolation | Browser sandbox |
