# Local MCP Server Config Guide

Expose your resume and application log tools to Claude Desktop (or other AI agents/clients) using the Model Context Protocol (MCP).

## Claude Desktop Integration

Add the configuration snippet below to your Claude Desktop configuration file:

`~/Library/Application Support/Claude/claude_desktop_config.json`

If the file does not exist, create it. Add this server registration to the `"mcpServers"` object:

```json
{
  "mcpServers": {
    "resume-editor": {
      "command": "node",
      "args": [
        "/Users/mfuad16/Documents/Resume/editor/server/mcp-server.js"
      ]
    }
  }
}
```

### Restart Claude Desktop
Once saved, **completely restart** the Claude Desktop application (Quit from menu bar and relaunch). 
A plug icon (🔌) will appear in the input chat area, showing that the `resume-editor` server tools are active and ready to be used by Claude!

---

## Exposed Tools

The following tools will be made available to your AI assistant:

1. `get_resume`
   - **Description**: Returns the parsed JSON resume data.
   - **Use Case**: Allows AI agents to read your skills, education, and experience.

2. `get_resume_markdown`
   - **Description**: Returns the AI-optimized Markdown resume profile.
   - **Use Case**: Provides structured markdown formatting ideal for job matching and embedding into LLM contexts.

3. `get_resume_pdf_paths`
   - **Description**: Returns the absolute file paths to your compiled English and Japanese PDF resumes.
   - **Use Case**: Allows AI agents to find the local PDFs and submit/attach them to job forms.

4. `log_job_application`
   - **Description**: Logs an internship/job application dossier and auto-generates a tailored cover letter.
   - **Args**: `company` (string), `jobTitle` (string), `jobDescription` (string), `notes` (string, optional)
   - **Use Case**: AI agents can call this tool to log applications. It automatically creates a markdown record inside `editor/server/applications/` and formats a customized cover letter for you.

---

## Testing / Running Manually
You can test that the MCP server responds correctly to JSON-RPC requests by running the E2E verification script:

```bash
cd /Users/mfuad16/Documents/Resume/editor
node server/test-mcp.js
```
