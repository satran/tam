import "/_s/codemirror.js";
import "/_s/taskpaper.js";
import "/_s/codemirror-indent-guide.js"
import "/_s/addon/display/panel.js"
import "/_s/addon/fold/foldcode.js"
import "/_s/addon/fold/foldgutter.js"
import "/_s/addon/fold/indent-fold.js"


(function() {
    const filename = "default";
    const lastUpdateKey = "last-updated";

    let conn = new WebSocket("ws://" + document.location.host + "/ws");
    conn.onclose = function(_) {
        alert("connection closed, reload window");
    };

    // Load draft from localstorage
    let value = localStorage.getItem(filename);
    if (!value) {
        value = "";
    }

    let cm = CodeMirror(document.getElementById("editor"), {
        value: value,
        mode: "taskpaper",
        lineWrapping: true,
        autofocus: true,
        autocapitalize: true,
        autocorrect: true,
        cursorBlinkRate: 0,
        indentWithTabs: true,
        tabSize: 2,
        indentUnit: 2,
        //indentGuide: true,
          foldGutter: { rangeFinder: CodeMirror.fold.indent },
          gutters: ["CodeMirror-foldgutter"],
        spellcheck: true
    });
    
    let searchNode = document.createElement('div');
    searchNode.innerHTML = document.getElementById('search-bar-tmpl').innerHTML;
    cm.addPanel(searchNode, {position: "top"});
    let searchInput = document.getElementById('search');

    //var charWidth = cm.defaultCharWidth(), basePadding = 4;
    //cm.on("renderLine", function(cm, line, elt) {
    //    var off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth;
    //    elt.style.textIndent = "-" + off + "px";
    //    elt.style.paddingLeft = (basePadding + off) + "px";
    //});
    //cm.refresh();

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
        }
    }
    cm.on("mousedown", gotoElement);
    cm.on("touchstart", gotoElement);


    // DEV hack
    window.cm = cm;

    conn.onmessage = function(evt) {
        cm.setValue(evt.data);
    };

    let cancel;
    cm.on("changes", () => {
        if (cancel) clearTimeout(cancel);
        cancel = setTimeout(() => {
            localStorage.setItem(filename, cm.getValue());
            localStorage.setItem(lastUpdateKey, new Date().getTime());
        }, 5000);
    });

    function showAll(editor) {
        editor.doc.getAllMarks().forEach(marker => marker.clear());
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
        let matched = line.match(query);
        return matched !== null && matched.length > 0;
    }

    function filter(editor, query) {
        showAll(editor);
        let headers = [];
        let lines = editor.getValue().split("\n");
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trimRight();
            let depth = getDepth(line);
            for (let j = headers.length - 1; j >= 0; j--) {
                if (headers[j].depth >= depth) {
                    headers.pop();
                    continue;
                }else {
                    break;
                }
            }
            let header = getHeader(line);
            if (!match(line, query)){
                let mark = editor.markText({ line: i, ch: 0 }, { line: i }, { inclusiveRight: true, inclusiveLeft: true, collapsed: true, clearWhenEmpty: false });
                if (header.header) {
                    headers.push({line: i, mark: mark, depth: header.depth, shown: false});
                }
            } else {
                for (let j = 0; j<headers.length; j++){
                    if (headers[j].shown){
                        continue;
                    }
                    headers[j].mark.clear();
                    headers[j].shown = true;
                }
            }
        }
    }

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

    document.getElementById("sync-btn").addEventListener("click", function(e) {
        conn.send(cm.getValue());
    });
})();

