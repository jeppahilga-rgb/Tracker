export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json();

    if (body.ping) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const { path, content, message } = body;

    const repoOwner = env.GITHUB_REPO_OWNER;
    const repoName = env.GITHUB_REPO_NAME;
    const branch = env.GITHUB_BRANCH || "main";
    const token = env.GITHUB_TOKEN;

    const getUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`;

    const getRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (!getRes.ok) {
      return new Response("Failed to fetch file", { status: 500 });
    }

    const current = await getRes.json();
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));

    const putRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        content: encoded,
        sha: current.sha,
        branch
      })
    });

    if (!putRes.ok) {
      return new Response("Failed to write file", { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};