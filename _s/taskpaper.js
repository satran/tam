import "/_s/simple.js";

CodeMirror.defineSimpleMode("taskpaper", {
    start: [
        { regex: /(.*):$/, token: "header", sol: true, indent: true },
        { regex: /(\s*)([\-x]) /, token: [null, "task", null], sol: true },
        { regex: /search\((.*)\)/, token: "search" },
        { regex: /(#[a-zA-Z_\-\.\/]+)/, token: ["tag"]},
        { regex: /(@[0-9a-zA-Z_\-\.\/\(\),]*)/, token: ["function"]},
        { regex: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, token: "url" }
    ],
    // The meta property contains global information about the mode. It
    // can contain properties like lineComment, which are supported by
    // all modes, and also directives like dontIndentStates, which are
    // specific to simple modes.
    meta: {
        dontIndentStates: ["comment"],
        lineComment: "//"
    }
});
