#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  ghPath: "/opt/homebrew/bin/gh", // Full path to gh CLI (run 'which gh' to find yours)
  quickPath: "/opt/homebrew/bin/quick", // Full path to quick CLI (run 'which quick' to find yours)
  quickSiteName: "analytics-experience-pr-report", // Your Quick site name
  repos: [
    "shop/world",
    "Shopify/globe-visuals-js",
    "Shopify/polaris-viz-internal",
    "Shopify/merchant-analytics-api",
    "Shopify/shopifyql",
  ], // Add more repos as needed
  owners: [
    "503stevenson",
    "bencmilton",
    "carysmills",
    "envex",
    "hannahl123",
    "JeremyLudwigDev",
    "kvendrik",
    "maryamkaka",
    "michaelnesen",
    "mkevinq",
    "mollerjorge",
    "Passanelli",
    "pbojinov",
    "philschoefer",
    "rita-morozova",
    "susiekims",
    "thetrevorharmon",
    "tylernoseworth",
  ],
};

// ===========================
// SHARED UTILITY FUNCTIONS
// ===========================

/**
 * Extract repository name from GitHub URL
 */
function extractRepoFromUrl(url) {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\//);
  return match ? match[1] : "Unknown";
}

/**
 * Build repository count map from PRs
 */
function buildRepoCount(prs) {
  const repoCount = {};
  for (const pr of prs) {
    const repo = extractRepoFromUrl(pr.url);
    repoCount[repo] = (repoCount[repo] || 0) + 1;
  }
  return repoCount;
}

/**
 * Format a date in short format (e.g., "Jan 15")
 */
function formatDateShort(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Get environment configuration for external commands
 */
function getCommandEnv() {
  return {
    ...process.env,
    GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    HOME: process.env.HOME || "/Users/tchilds",
    PATH:
      "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:" +
      (process.env.PATH || ""),
  };
}

/**
 * Read external file content
 */
function readExternalFile(filename) {
  const filePath = path.join(__dirname, filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

// ===========================
// CORE BUSINESS LOGIC
// ===========================

/**
 * Calculate last week's date range (Monday through Sunday) in Eastern timezone
 */
function getLastWeekDateRange() {
  // Get current date in Eastern timezone
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );

  // Get the day of week (0 = Sunday, 1 = Monday, etc.)
  const currentDay = now.getDay();

  // Calculate days to subtract to get to last Monday
  // If today is Sunday (0), go back 6 days. If Monday (1), go back 7 days, etc.
  const daysToLastMonday = currentDay === 0 ? 6 : currentDay + 6;

  // Calculate last Monday
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);

  // Calculate last Sunday (6 days after last Monday)
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  // Format dates without timezone conversion
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    start: formatDate(lastMonday),
    end: formatDate(lastSunday),
    startFormatted: lastMonday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    endFormatted: lastSunday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

/**
 * Fetch merged PRs from GitHub using gh CLI
 */
function fetchPRs(repo, dateRange) {
  console.log(`  Fetching merged PRs from ${repo}...`);

  const allPRs = [];

  // Fetch PRs for each owner
  for (const owner of CONFIG.owners) {
    try {
      const command = `${CONFIG.ghPath} pr list --repo ${repo} --state merged --author ${owner} --limit 1000 --json number,title,author,mergedAt,labels,url`;
      console.log(`    Running: ${command}`);

      const output = execSync(command, {
        encoding: "utf8",
        env: getCommandEnv(),
      });
      const prList = JSON.parse(output);

      // Filter by date range (only merged PRs)
      const filtered = prList.filter((pr) => {
        if (!pr.mergedAt) return false; // Skip if not merged
        const mergedDate = pr.mergedAt.split("T")[0];
        return mergedDate >= dateRange.start && mergedDate <= dateRange.end;
      });

      allPRs.push(...filtered);
    } catch (error) {
      console.error(
        `    Error fetching PRs for author ${owner}:`,
        error.message,
      );
    }
  }

  // Remove duplicates by PR number
  const uniquePRs = Array.from(
    new Map(allPRs.map((pr) => [pr.number, pr])).values(),
  );
  console.log(`  Found ${uniquePRs.length} PRs`);

  return uniquePRs;
}

/**
 * Categorize PRs based on labels
 */
function categorizePRs(prs) {
  const categories = {
    Testing: [],
    Payments: [],
    Features: [],
    "Build & Tooling": [],
    "Bug Fixes": [],
    Documentation: [],
    Performance: [],
    Other: [],
  };

  for (const pr of prs) {
    const labels = pr.labels.map((l) => l.name.toLowerCase());

    if (labels.some((l) => l.includes("test"))) {
      categories["Testing"].push(pr);
    } else if (labels.some((l) => l.includes("payment"))) {
      categories["Payments"].push(pr);
    } else if (labels.some((l) => l.includes("feature"))) {
      categories["Features"].push(pr);
    } else if (
      labels.some(
        (l) => l.includes("build") || l.includes("tooling") || l.includes("ci"),
      )
    ) {
      categories["Build & Tooling"].push(pr);
    } else if (labels.some((l) => l.includes("bug") || l.includes("fix"))) {
      categories["Bug Fixes"].push(pr);
    } else if (labels.some((l) => l.includes("doc"))) {
      categories["Documentation"].push(pr);
    } else if (
      labels.some((l) => l.includes("performance") || l.includes("perf"))
    ) {
      categories["Performance"].push(pr);
    } else {
      categories["Other"].push(pr);
    }
  }

  return categories;
}

// ===========================
// REPORT FORMATTING
// ===========================

/**
 * Format the PR report
 */
function formatReport(dateRange, allPRs) {
  let report = `:mega: *Weekly PR Report*\n`;
  report += `*Week of ${dateRange.startFormatted} - ${dateRange.endFormatted}*\n\n`;

  if (allPRs.length === 0) {
    report += `No PRs were merged this week.\n\n`;
    report += `*Total PRs merged: 0*\n`;
  } else {
    // Add all PRs
    report += `*Pull Requests:*\n`;
    for (const pr of allPRs) {
      const date = formatDateShort(pr.mergedAt);
      report += `• <${pr.url}> ${pr.title} (@${pr.author.login}, ${date})\n`;
    }

    // Add summary section at the end
    report += `\n*Total PRs merged: ${allPRs.length}*\n\n`;

    // Add summary by repository
    const repoCount = buildRepoCount(allPRs);

    report += `*Summary by Repository:*\n`;
    for (const [repo, count] of Object.entries(repoCount).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      report += `• ${repo}: ${count} PR${count !== 1 ? "s" : ""}\n`;
    }
  }

  return report;
}

/**
 * Generate HTML for a single week's report as a details element
 * @param {Object} dateRange - The date range object
 * @param {Array} allPRs - Array of PR objects
 * @param {boolean} isOpen - Whether the details should be open by default
 */
function formatWeekReportAsDetails(dateRange, allPRs, isOpen = false) {
  // Build summary by repository
  const repoCount = buildRepoCount(allPRs);

  let html = `
    <details${isOpen ? " open" : ""} class="week-report">
      <summary>${dateRange.startFormatted} - ${dateRange.endFormatted}</summary>
      <div class="report-content">
        <h2>Pull Requests Merged</h2>`;

  if (allPRs.length === 0) {
    html += `
        <div style="text-align: center; padding: 40px 20px; color: #7f8c8d;">
          <p style="font-size: 1.1em;">No PRs were merged this week.</p>
        </div>`;
  } else {
    // Group PRs by repository
    const prsByRepo = {};
    for (const pr of allPRs) {
      const repo = extractRepoFromUrl(pr.url);
      if (!prsByRepo[repo]) {
        prsByRepo[repo] = [];
      }
      prsByRepo[repo].push(pr);
    }

    // Sort repos alphabetically (case-insensitive)
    const sortedRepos = Object.keys(prsByRepo).sort((a, b) =>
      a.localeCompare(b),
    );

    // Render PRs grouped by repository
    for (const repo of sortedRepos) {
      html += `
        <details open class="repo-section">
          <summary class="repo-heading">📁 ${repo}</summary>
          <ul class="pr-list">`;

      for (const pr of prsByRepo[repo]) {
        const date = formatDateShort(pr.mergedAt);
        html += `
            <li class="pr-item">
              <a href="${pr.url}" class="pr-link" target="_blank">${pr.title}</a>
              <div class="pr-meta">@${pr.author.login} • ${date} • ${repo}</div>
            </li>`;
      }

      html += `
          </ul>
        </details>`;
    }
  }

  html += `

        <div class="summary">
          <h2>Summary</h2>
          <div class="stat">Total PRs merged: ${allPRs.length}</div>`;

  if (Object.keys(repoCount).length > 0) {
    html += `

          <h3 style="margin-top: 20px; margin-bottom: 10px;">By Repository:</h3>`;

    for (const [repo, count] of Object.entries(repoCount).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      html += `
          <div class="repo-stat">${repo}: ${count} PR${
            count !== 1 ? "s" : ""
          }</div>`;
    }
  }

  html += `
        </div>
      </div>
    </details>`;

  return html;
}

/**
 * Convert report to HTML (full page with all weeks)
 */
function formatReportAsHTML(dateRange, allPRs) {
  // Load external CSS and JS
  const cssContent = readExternalFile("styles.css");
  const jsContent = readExternalFile("search.js");

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly PR Reports - Analytics Experience</title>
  <style>
${cssContent}
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Analytics Experience Weekly PR Reports</h1>

    <div class="search-container">
      <input
        type="text"
        id="searchInput"
        class="search-input"
        placeholder="Search PRs by title, author, or repo..."
      />
      <button class="clear-search" id="clearSearch" title="Clear search">&times;</button>
      <span class="search-icon">🔍</span>
      <div class="search-stats" id="searchStats"></div>
    </div>

    <div class="no-results-message" id="noResults">
      No PRs found matching your search criteria.
    </div>

    <div id="reports">
      <!-- Weekly reports will be inserted here -->
    </div>

    <div class="updated">Last updated: ${new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    })}</div>
  </div>

  <script>
${jsContent}
  </script>
</body>
</html>`;

  return html;
}

/**
 * Format a summary report for Google Drive
 */
function formatSummaryReport(dateRange, allPRs) {
  // Build summary by repository
  const repoCount = buildRepoCount(allPRs);

  let summary = `:mega: *Weekly PR Report*\n\n`;
  summary += `*${dateRange.startFormatted} - ${dateRange.endFormatted}*\n\n`;
  summary += `*Summary:*\n\n`;
  summary += `Total PRs merged: ${allPRs.length}\n\n`;

  if (allPRs.length === 0) {
    summary += `No PRs were merged this week.\n\n`;
  } else {
    summary += `*By Repository:*\n`;
    for (const [repo, count] of Object.entries(repoCount).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      summary += `• ${repo}: ${count} PR${count !== 1 ? "s" : ""}\n`;
    }
    summary += `\n`;
  }

  summary += `:bar_chart: See the <https://${CONFIG.quickSiteName}.quick.shopify.io|Analytics Experience Weekly PR Report> for more details.\n`;

  return summary;
}

// ===========================
// FILE OPERATIONS
// ===========================

/**
 * Save report to Google Drive
 */
function saveReportToGoogleDrive(report) {
  const driveFolder = "/Users/tchilds/Library/CloudStorage/GoogleDrive-tammie.childs@shopify.com/My Drive/PR Reports/"

  // Create folder if it doesn't exist
  if (!fs.existsSync(driveFolder)) {
    fs.mkdirSync(driveFolder, { recursive: true });
    console.log(`Created folder: ${driveFolder}`);
  }

  // Always use the same filename to overwrite
  const fileName = "latest-pr-report.txt";
  const filePath = path.join(driveFolder, fileName);

  // Write report to file (overwrites existing file)
  fs.writeFileSync(filePath, report);
  console.log(`✓ Report saved to: ${filePath}`);

  return filePath;
}

/**
 * Deploy report to Quick
 */
function deployToQuick(dateRange, allPRs) {
  console.log("\n🚀 Deploying to Quick...");

  const distPath = path.join(__dirname, "dist");

  // Create dist folder if it doesn't exist
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }

  const indexPath = path.join(distPath, "index.html");

  // Generate the new week's report as a details element (open by default)
  const newWeekReport = formatWeekReportAsDetails(dateRange, allPRs, true);

  let finalHTML;

  // Check if index.html already exists
  if (fs.existsSync(indexPath)) {
    console.log("  Found existing index.html, appending new report...");

    // Read existing HTML
    const existingHTML = fs.readFileSync(indexPath, "utf-8");

    // Extract existing reports (everything inside <div id="reports">...</div>)
    const reportsMatch = existingHTML.match(
      /<div id="reports">([\s\S]*?)<\/div>\s*<div class="updated">/,
    );

    let existingReports = reportsMatch ? reportsMatch[1].trim() : "";

    // Remove 'open' attribute from existing reports so only the new one is expanded
    existingReports = existingReports.replace(/<details\s+open/g, "<details");

    // Create updated HTML with new report at the top
    const updatedTimestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    });

    finalHTML = formatReportAsHTML(dateRange, allPRs);

    // Insert new report at the top, followed by existing reports
    const reportsContent = newWeekReport + "\n" + existingReports;
    finalHTML = finalHTML.replace(
      /(<div id="reports">)[\s\S]*?(<\/div>\s*<div class="updated">)/,
      `$1\n${reportsContent}\n    $2`,
    );

    // Update timestamp
    finalHTML = finalHTML.replace(
      /Last updated: .*?<\/div>/,
      `Last updated: ${updatedTimestamp}</div>`,
    );
  } else {
    console.log("  Creating new index.html...");

    // Create new HTML with just this week's report (open by default since it's the only one)
    finalHTML = formatReportAsHTML(dateRange, allPRs);
    finalHTML = finalHTML.replace(
      /(<div id="reports">)[\s\S]*?(<\/div>\s*<div class="updated">)/,
      `$1\n${newWeekReport}\n    $2`,
    );
  }

  // Write the final HTML
  fs.writeFileSync(indexPath, finalHTML);

  try {
    // Run the quick deploy command with auto-yes for cron compatibility
    const command = `echo 'y' | ${CONFIG.quickPath} deploy ${distPath} ${CONFIG.quickSiteName}`;
    console.log(`  Running: ${command}`);

    execSync(command, {
      encoding: "utf-8",
      stdio: "inherit",
      shell: true,
      env: getCommandEnv(),
    });

    console.log("✅ Deployed successfully!");
    console.log(`🌐 Visit: https://${CONFIG.quickSiteName}.quick.shopify.io`);
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

// ===========================
// MAIN EXECUTION
// ===========================

/**
 * Main execution function
 */
function main() {
  console.log("=".repeat(80));
  console.log("Weekly PR Report Generator");
  console.log("=".repeat(80));
  console.log(
    `Started at: ${new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    })}`,
  );
  console.log();

  // Calculate date range
  const dateRange = getLastWeekDateRange();
  console.log(
    `Report period: ${dateRange.startFormatted} - ${dateRange.endFormatted}`,
  );
  console.log(`Date range: ${dateRange.start} to ${dateRange.end}`);
  console.log();

  // Fetch merged PRs from all configured repos
  console.log("Fetching merged PRs from GitHub...");
  let allPRs = [];
  for (const repo of CONFIG.repos) {
    const prs = fetchPRs(repo, dateRange);
    allPRs.push(...prs);
  }

  if (allPRs.length === 0) {
    console.log(
      "\nNo merged PRs found for the specified date range and criteria.",
    );
    console.log("Continuing to generate empty report...");
  }

  console.log(`\nTotal merged PRs found: ${allPRs.length}`);
  console.log();

  // Format report (text version)
  console.log("Formatting report...");
  const report = formatReport(dateRange, allPRs);

  // Display report
  console.log("\n" + "=".repeat(80));
  console.log("REPORT PREVIEW");
  console.log("=".repeat(80));
  console.log(report);
  console.log("=".repeat(80));

  // Save summary to Google Drive
  console.log();
  try {
    const summaryReport = formatSummaryReport(dateRange, allPRs);
    saveReportToGoogleDrive(summaryReport);
    console.log("✓ Summary saved to Google Drive");
  } catch (error) {
    console.error("✗ Failed to save to Google Drive:", error.message);
  }

  // Deploy to Quick (will append to existing reports)
  try {
    deployToQuick(dateRange, allPRs);
  } catch (error) {
    console.error("✗ Failed to deploy to Quick:", error.message);
  }

  console.log("\n✓ Report generated successfully");

  console.log();
  console.log(
    `Completed at: ${new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    })}`,
  );
  console.log("=".repeat(80));
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  getLastWeekDateRange,
  fetchPRs,
  formatReport,
  formatSummaryReport,
  formatReportAsHTML,
  formatWeekReportAsDetails,
  saveReportToGoogleDrive,
  deployToQuick,
};
