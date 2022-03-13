import "/_s/codemirror.js";
import "/_s/taskpaper.js";
import "/_s/addon/hint/show-hint.js";
import "/_s/addon/hint/tag-hint.js";
import "/_s/addon/selection/active-line.js";
import "/_s/keymap/sublime.js";


(function() {
    const filename = "default";
    const lastUpdateKey = "last-updated";

    // Load draft from localstorage
    let value = localStorage.getItem(filename);
    if (!value) {
        value = "";
    }

    let cm = CodeMirror(document.getElementById("container"), {
        value: value,
        mode: "taskpaper",
        keyMap: "sublime",
        lineWrapping: true,
        autofocus: true,
        autocapitalize: true,
        autocorrect: true,
        cursorBlinkRate: 0,
        indentWithTabs: true,
        tabSize: 4,
        indentUnit: 4,
        extraKeys: { "Ctrl-Space": "autocomplete" },
        styleActiveLine: true,
        spellcheck: true,
        //viewportMargin: Infinity,
    });

    function newAlert(message, refreshFn) {
        let infoNode = document.createElement('div');
        infoNode.setAttribute("class", "alert-bar");
        infoNode.innerHTML = document.getElementById('info-bar-tmpl').innerHTML;
        $(document.body).append(infoNode);
        $(infoNode).find(".close").click(() => {
            $(infoNode).remove();
        });
        $(infoNode).find(".message").html(message);
        $(infoNode).find(".refresh").click((e) => {
            refreshFn(e, () => $(infoNode).remove());
        });
        return infoNode;
    }

    let conn;
    function newConn(editor) {
        let c = new WebSocket("ws://" + document.location.host + "/ws");

        c.onmessage = function(evt) {
            editor.setValue(evt.data);
        };

        c.onclose = function(_) {
            newAlert("Connection lost, refresh to sync", (_, destroy) => {
                conn = newConn(editor);
                destroy();
            });
        };
        return c;
    }

    conn = newConn(cm);

    let searchInput = document.getElementById('search');

    //var charWidth = cm.defaultCharWidth(), basePadding = 4;
    //cm.on("renderLine", function(cm, line, elt) {
    //    var off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth;
    //    elt.style.textIndent = "-" + off + "px";
    //    elt.style.paddingLeft = (basePadding + off) + "px";
    //});
    //cm.refresh();

    function narrowToHeading(editor, line) {
        showAll(editor);
        if (line > 0) {
            editor.markText({ line: 0, ch: 0 }, { line: line - 1 }, { inclusiveRight: true, inclusiveLeft: true, collapsed: true, clearWhenEmpty: false });
        }
        let end = editor.lineCount();
        if (line >= end) {
            return;
        }
        let headerDepth = getDepth(editor.getLine(line));
        let start = line + 1;
        editor.doc.eachLine(start, end, (l) => {
            let depth = getDepth(l.text);
            if (depth <= headerDepth) return true;
            start++;
        });
        if (start <= end) {
            editor.markText({ line: start, ch: 0 }, { line: end }, { inclusiveRight: true, inclusiveLeft: true, collapsed: true, clearWhenEmpty: false });
        }
    }

    function gotoElement(editor, e) {
        var et = $(e.target);

        // Direct url-click
        if (et.hasClass('cm-tag')) {
            let tag = $(e.target).text().replace(/[\(\)]+/g, '');
            searchInput.value = tag;
            filter(cm, tag);
        } else if (et.hasClass('cm-search')) {
            let search = $(e.target).text();
            let re = /search\((?<search>.*)\)/mg;
            let matched = re.exec(search);
            let query = matched.groups.search;
            searchInput.value = query;
            filter(cm, query);
        } else if (et.hasClass('cm-url')) {
            let url = $(e.target).text();
            window.open(url);
        } else if (et.hasClass('cm-header')) {
            let line = editor.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
            narrowToHeading(editor, line.line);
        } else if (et.hasClass('cm-task') || et.hasClass('cm-done')) {
            let lineCh = editor.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
            let line = editor.getLine(lineCh.line);
            let done = line.replace(/(^\s*)([\-x])(.*)/, (...args) => {
                if (args.length < 4) { // we need [whole match, tabs, task, text]
                    return;
                }
                let match = args[2];
                if (match == '-') {
                    match = 'x';
                } else if (match == 'x') {
                    match = '-';
                }
                return args[1] + match + args[3];
            });
            cm.doc.replaceRange(done, { line: lineCh.line, ch: 0 }, { line: lineCh.line });
        }
    }
    cm.on("mousedown", gotoElement);
    cm.on("touchstart", gotoElement);


    // DEV hack
    window.cm = cm;

    let cancel;
    cm.on("changes", () => {
        if (cancel) clearTimeout(cancel);
        cancel = setTimeout(() => {
            localStorage.setItem(filename, cm.getValue());
            localStorage.setItem(lastUpdateKey, new Date().getTime());
        }, 5000);
    });

    function showAll(editor) {
        let cursor = editor.getCursor();
        editor.doc.getAllMarks().forEach(marker => marker.clear());
        editor.focus();
        editor.setCursor({ line: cursor.line, ch: cursor.ch }, { scroll: true });
    }

    function getDepth(line) {
        let depth = 0;
        let matched = line.match(/^\s*/);
        if (matched !== null && matched.length === 1) {
            depth = matched[0].length;
        }
        return depth;
    }

    function getHeader(line) {
        if (!line.endsWith(":")) return { header: false, depth: 0 };
        return { header: true, depth: getDepth(line) };
    }

    function match(line, query) {
        let today = new Date().toISOString().split('T')[0];
        query = query.replace("@today", today);

        let parts = query.split(" ");
        for (let part of parts) {
            let matched = line.match(part);
            if (matched === null || matched.length == 0) return false;
        }
        return true;
    }

    function filter(editor, query) {
        showAll(editor);
        let headers = [];
        let doc = editor.getDoc();
        doc.eachLine((l) => {
            let line = l.text;
            let depth = getDepth(line);
            for (let j = headers.length - 1; j >= 0; j--) {
                if (headers[j].depth >= depth) {
                    headers.pop();
                    continue;
                } else {
                    break;
                }
            }
            let header = getHeader(line);
            let lineNo = l.lineNo();
            if (!match(line, query)) {
                let mark = editor.markText({ line: lineNo, ch: 0 }, { line: lineNo }, { inclusiveRight: true, inclusiveLeft: true, collapsed: true, clearWhenEmpty: false });
                if (header.header) {
                    headers.push({ line: lineNo, mark: mark, depth: header.depth, shown: false });
                }
            } else {
                for (let j = 0; j < headers.length; j++) {
                    if (headers[j].shown) {
                        continue;
                    }
                    headers[j].mark.clear();
                    headers[j].shown = true;
                }
            }
        });
    }

    let done = false;
    let donemarks = [];
    document.getElementById("toggle-done").addEventListener("click", function(e) {
        if (!done) {
            cm.eachLine((l) => {
                let line = l.text;
                if (!line.match(/^\s*x /)) return;
                let lineNo = l.lineNo();
                let mark = cm.markText({ line: lineNo, ch: 0 }, { line: lineNo }, { inclusiveRight: true, inclusiveLeft: true, collapsed: true, clearWhenEmpty: false });
                donemarks.push(mark);
            });
        } else {
            for (let mark of donemarks) {
                mark.clear();
            }
            donemarks = [];
        }
        done = !done;
    });

    searchInput.addEventListener("keypress", function(e) {
        if (e.code !== "Enter") return;
        let query = searchInput.value.trim();
        if (query === "") {
            showAll(cm);
            return;
        }
        filter(cm, query);
    });

    document.getElementById("search-clear").addEventListener("click", function(e) {
        searchInput.value = "";
        showAll(cm);
    });

    document.getElementById("sync-btn").addEventListener("click", function(_) {
        conn.send(cm.getValue());
    });
})();

