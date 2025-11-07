# Anki Code Execution Plugin Research

## Executive Summary

**Question:** Is it possible to build an Anki plugin that supports code execution for practicing coding with predefined test cases? Does such a plugin already exist?

**Answer:**

✅ **YES, it is possible** to build such a plugin, and there are multiple approaches to implement it.

✅ **YES, a solution already exists:** [AnkiCode](https://ankicode.app/) is a modified version of Anki that includes code execution capabilities with predefined test cases for algorithm practice.

However, AnkiCode is a **standalone application** (forked from Anki), not a plugin for the standard Anki application. For standard Anki, **no such plugin currently exists**, but this research demonstrates it is technically feasible and practical to build one.

---

## Existing Solutions

### AnkiCode - The Only Complete Solution

**Overview:**
- **Type:** Standalone application (fork of Anki)
- **Website:** https://ankicode.app/ | https://daveight.github.io/ankicode/
- **GitHub:** https://github.com/daveight/ankicode
- **Developer:** daveight

**Key Features:**
- Custom "Programming Challenge" card type with integrated code editor
- Supports: C++, Kotlin, Java, JavaScript, and Python
- Code execution runtime bundled in the app - runs locally
- Syntax highlighting and theme selection
- Pre-made decks based on LeetCode problems and "Elements of Programming Interviews"
- Platforms: Windows 10/11 (1.3 GB), macOS Intel (383 MB), macOS ARM (671 MB)

**Limitations:**
- Desktop only (no web or mobile support)
- Large download size due to bundled language runtimes
- Separate application - can't use with existing Anki installation
- Must maintain compatibility with upstream Anki updates

### Other Related Tools (No Code Execution)

**Code Display Only:**
- **badlydrawnrob/anki**: Flashcard templates with syntax highlighting for displaying code
- **anki-code-highlighter**: Plugin for syntax highlighting only
- **CodeMirror Anki addon**: Integrates CodeMirror editor for creating flashcards with formatted code

**External Systems:**
- **donnemartin/interactive-coding-challenges**: Jupyter notebooks with tests + separate Anki flashcards
- **Code Cards**: Alternative flashcard website with code editor (not Anki-based)

---

## Technical Feasibility: Building an Anki Plugin

### Is It Possible? YES - Three Approaches

#### 1. Browser-Based with Pyodide (RECOMMENDED) ⭐

**Approach:** Embed code execution directly in card templates using WebAssembly.

**Technology Stack:**
- **Pyodide:** Python runtime compiled to WebAssembly
- **CodeMirror/Monaco Editor:** In-browser code editor
- **JavaScript:** Test case validation and UI

**Advantages:**
- ✅ No addon installation required (can be just a card template)
- ✅ Works on Desktop, AnkiWeb, and potentially AnkiMobile
- ✅ Secure (browser sandbox isolation)
- ✅ Cross-platform compatibility
- ✅ Easy to distribute (export/import deck)
- ✅ ~10-30MB download vs 383MB-1.3GB for AnkiCode
- ✅ Users can modify templates to fit their needs

**Disadvantages:**
- ⚠️ Initial load time (2-10 seconds for Pyodide)
- ⚠️ Limited to WebAssembly-compatible languages (Python, C++, Rust, etc.)
- ⚠️ Not all Python packages available
- ⚠️ Requires modern browser with WebAssembly support

**Implementation Details:**

```html
<!-- Simplified example of card template -->
<script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>

<div class="problem">{{ProblemDescription}}</div>
<textarea id="code">{{UserCode}}</textarea>
<button onclick="runTests()">Run Tests</button>
<div id="results"></div>

<script>
  // Load Pyodide and execute user code with test cases
  async function runTests() {
    const pyodide = await loadPyodide();
    const code = document.getElementById('code').value;
    await pyodide.runPythonAsync(code);
    // Run test cases and display results
  }
</script>
```

See `proof-of-concept.html` for a working demonstration.

#### 2. Addon with Custom Card Type (MODERATE COMPLEXITY)

**Approach:** Create a Python addon that provides a custom card type with enhanced features.

**Features:**
- Pre-load Pyodide once per session for better performance
- Custom UI for test results, progress tracking, statistics
- Integration with CodeMirror for enhanced editing
- Deck generation tools
- Still uses browser-based execution for cross-platform support

**Advantages:**
- ✅ Better performance than pure template approach
- ✅ More polished user experience
- ✅ Can add advanced features (statistics, progress tracking)
- ✅ Still cross-platform compatible

**Disadvantages:**
- ⚠️ Requires addon installation and maintenance
- ⚠️ More complex development
- ⚠️ Need to maintain compatibility with Anki versions

#### 3. Desktop-Only with Subprocess (COMPLEX, LIMITED)

**Approach:** Similar to AnkiCode - bundle language runtimes and execute via subprocess.

**This is essentially what AnkiCode does.** Would require:
- Bundling language runtimes (Python, Java, etc.)
- Subprocess management for code execution
- OS-level security measures
- Platform-specific builds

**Not recommended** unless you need languages without WebAssembly support.

---

## Technical Deep Dive

### Anki Plugin Architecture

**What Anki Addons Can Do:**
- Written in Python, loaded at startup
- Full access to Anki's Python API and hooks
- Can modify UI, add menu items, create custom dialogs
- Can execute arbitrary Python code, including subprocess calls
- Official docs: https://addon-docs.ankiweb.net/

**Card Template Capabilities:**
- Templates support HTML, CSS, and JavaScript
- Rendered as webpages (Chromium on desktop, Safari on mobile)
- JavaScript execution is supported but not officially documented
- Can load external JavaScript libraries from CDN
- Limited persistent storage (no window.py in Anki 2.1+)

### Security Considerations

**Python Sandboxing Challenges:**
- Pure Python sandboxing is **extremely difficult** and **not recommended**
- Python's introspection allows many escape routes
- Python's audit hooks are "not suitable for implementing a sandbox"
- Malicious code can trivially disable Python-based sandboxes

**Safe Execution Approaches:**

1. **Browser Sandbox (Recommended):**
   - WebAssembly runs in browser's security sandbox
   - Isolated from file system and network (unless granted permission)
   - Pyodide provides excellent isolation
   - Used by JupyterLite and educational platforms

2. **OS-Level Isolation:**
   - AppArmor, seccomp, containers
   - Appropriate for desktop-only solutions
   - Complex to implement correctly

3. **Process Isolation:**
   - Run code in separate processes with restricted privileges
   - Better than pure Python sandbox
   - Still challenging to secure properly

### Pyodide: The Recommended Solution

**What is Pyodide?**
- Python runtime compiled to WebAssembly
- Runs Python in the browser without a backend server
- Includes NumPy, Pandas, Matplotlib, and other popular libraries
- Package installation via micropip
- Used in production by JupyterLite, educational platforms

**Why Pyodide is Perfect for Anki:**
- Browser-based: Works wherever Anki's card renderer works
- Secure: Browser sandbox provides strong isolation
- Educational-friendly: Designed for interactive learning platforms
- Well-maintained: Active development and community
- No backend required: Fits Anki's offline-first philosophy

**Limitations:**
- ~10-30MB download size (one-time, cacheable)
- 2-10 second initial load time
- Not all Python packages available (only pure Python or pre-compiled)
- Limited to Python (other languages need different WASM runtimes)

---

## Proof of Concept

A working proof-of-concept has been created in `proof-of-concept.html` demonstrating:

✅ Pyodide initialization and loading
✅ Code editor for user input
✅ "Run Code" button to execute Python
✅ "Run Tests" button with predefined test cases
✅ Pass/fail indicators for test results
✅ Hint system (useful for spaced repetition)
✅ Runs entirely in browser, no server needed

**Try it:** Open `proof-of-concept.html` in a modern browser to see it in action.

This demonstrates that the concept is **fully viable** and could be packaged as:
1. An Anki card template (no addon required)
2. A custom note type with the template
3. An addon that provides the card type with additional features

---

## Comparison: AnkiCode vs. Proposed Solution

| Feature | AnkiCode | Pyodide-Based Solution |
|---------|----------|------------------------|
| **Architecture** | Forked Anki app | Card template or addon |
| **Code Execution** | Bundled runtimes | Browser (WebAssembly) |
| **Supported Languages** | C++, Java, JS, Python, Kotlin | Python (+ other WASM langs) |
| **Platform Support** | Desktop only | Desktop + Web + Mobile |
| **Download Size** | 383MB - 1.3GB | ~10-30MB (Pyodide) |
| **Installation** | Separate app | Standard Anki (cards/addon) |
| **Maintenance** | Fork must track Anki updates | Works with standard Anki |
| **Offline Support** | Yes | Yes (with caching) |
| **Security** | OS-level isolation | Browser sandbox |
| **Sharing Decks** | Requires AnkiCode app | Works with standard Anki |
| **Mobile Support** | No | Yes (if browser supports WASM) |

---

## Implementation Roadmap

### Phase 1: Minimal Viable Product (Card Template Only)

**Goal:** Create a working card template that users can import.

**Tasks:**
1. Create card template with Pyodide integration
2. Add simple code editor (textarea or basic CodeMirror)
3. Implement test case runner with pass/fail indicators
4. Optimize Pyodide loading (caching, lazy loading)
5. Create example deck with common coding problems
6. Documentation and usage guide

**Estimated Effort:** 20-40 hours

### Phase 2: Enhanced Template with Better UX

**Goal:** Improve user experience without requiring addon.

**Tasks:**
1. Integrate full CodeMirror or Monaco Editor
2. Add syntax highlighting themes
3. Implement persistent code storage (localStorage)
4. Add hint system and solution reveal
5. Improve error messages and debugging output
6. Support multiple programming languages (via different WASM runtimes)

**Estimated Effort:** 40-60 hours

### Phase 3: Full Addon with Advanced Features

**Goal:** Create a polished addon with professional features.

**Tasks:**
1. Create Python addon that provides custom card type
2. Pre-load Pyodide once per session
3. Add statistics and progress tracking
4. Implement deck generation from LeetCode, HackerRank APIs
5. Add import/export for popular coding challenge formats
6. Create configuration UI
7. Write comprehensive documentation

**Estimated Effort:** 80-120 hours

---

## Recommendations

### For Users Who Want to Practice Coding Now:

1. **AnkiCode** - If you want a ready-to-use solution and don't mind a separate app
   - Download from https://ankicode.app/
   - Best for desktop users focused on algorithms
   - Includes pre-made LeetCode decks

2. **Wait for a plugin** - If you prefer using standard Anki
   - This research proves it's feasible
   - Could be developed as card template or addon
   - Would work across all Anki platforms

### For Developers Who Want to Build This:

**Start with Approach #1 (Pyodide + Card Template):**
- Fastest to implement and test
- No addon infrastructure needed
- Can iterate quickly
- Easy to share and get feedback
- Can always upgrade to addon later

**Key Technical Decisions:**
1. **Editor:** Start with textarea, upgrade to CodeMirror for better UX
2. **Loading:** Use CDN initially, add caching/bundling later
3. **Languages:** Start with Python only (Pyodide), add others if needed
4. **Distribution:** Share as .apkg deck initially, consider addon later

**Resources to Use:**
- Pyodide docs: https://pyodide.org/
- CodeMirror: https://codemirror.net/
- Anki template docs: https://docs.ankiweb.net/templates/intro.html
- This proof-of-concept: `proof-of-concept.html`

---

## Conclusion

Building an Anki plugin for code execution with test cases is **definitely possible** and **practically feasible**. While AnkiCode exists as a standalone solution, there's a clear opportunity for a plugin that works with standard Anki.

The **browser-based approach using Pyodide** is the most promising path forward because it:
- Works across all Anki platforms
- Provides strong security through browser sandboxing
- Requires minimal setup (possibly no addon at all)
- Has a smaller footprint than bundling language runtimes
- Fits Anki's offline-first, cross-platform philosophy

The proof-of-concept demonstrates that core functionality can be implemented relatively easily, with a clear path to enhancement through either improved templates or a full addon.

**Verdict:** This is a viable project worth pursuing, either as a community contribution or personal tool. The technical foundation exists, and the implementation is well within reach of an experienced developer.

---

## Files in This Investigation

- `notes.md` - Detailed research notes and findings
- `README.md` - This comprehensive report
- `proof-of-concept.html` - Working demonstration of Pyodide-based code execution

---

## References

1. AnkiCode: https://ankicode.app/ | https://github.com/daveight/ankicode
2. Pyodide Documentation: https://pyodide.org/
3. Anki Add-on Development: https://addon-docs.ankiweb.net/
4. Anki Card Templates: https://docs.ankiweb.net/templates/intro.html
5. CodeMirror Editor: https://codemirror.net/
6. Anki CodeMirror Addon: https://github.com/liwoe/anki-codemirror
7. Pyodide Security Discussion: https://github.com/pyodide/pyodide/issues/869
8. JupyterLite (Pyodide example): https://jupyterlite.readthedocs.io/

---

*Research conducted: 2025-11-07*
*Technologies researched: Anki, Pyodide, WebAssembly, Python, JavaScript*
