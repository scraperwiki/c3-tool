var editor
var c3code

var err = function(head, body) {
  console.log("got an error")

  latest_error = '<h1>' + head + '</h1><p>' + body + '</p>'
  $('#table').empty()
  $('#problem').html(latest_error)
  $('#problem').show()
}

var real_run = function() {
  console.log("real_run called")

  var sql_code = editor.getValue()
  var c3_code = c3code.getValue()
  scraperwiki.sql(sql_code, function (response) {
      if (!response || response.length < 1) {
	err("No data", "The table is empty")
      } else {
        //-----------------------------------------------------------
        eval(c3_code)
        /*
        var chart = c3.generate({
          bindto: "#mychart",
          data: {
              x: 'Date',
              json: response,
              keys: { value: ['Date', 'Low', 'High', 'Volume'] },
              axes: { Low: 'y', High: 'y', Volume: 'y2' }
          },
          point: {
              show: false
          },
          axis: {
              x: { type: 'timeseries', tick: { format: '%Y-%m-%d', count : 8 } },
              y2: { show : true },
          },
        })
        */
        //-----------------------------------------------------------
      }
      show_not_loading()
  }, function (response) {
      err("Error in SQL", jQuery.parseJSON(response.responseText))
      show_not_loading()
  })
}

var real_save = function() {
  console.log("real_save called")

  var sql_code = editor.getValue()
  var c3_code = c3code.getValue()
  var cmd = "mkdir -p code; cat >code/query.sql.$$.new <<\"ENDOFSCRAPER\"\n" + sql_code + "\nENDOFSCRAPER\n"
  cmd = cmd + "mv code/query.sql.$$.new code/query.sql"
  cmd = cmd + "; cat >code/chart.js.$$.new <<\"ENDOFSCRAPER\"\n" + c3_code + "\nENDOFSCRAPER\n"
  cmd = cmd + "mv code/chart.js.$$.new code/chart.js"
  scraperwiki.exec(cmd, function () {
  }, function (jqXHR, textStatus, errorThrown) {
    err("Error saving query", textStatus, true)
  })
}
var real_save_throttled = _.throttle(real_save, 750)

var loaded_empty
var load = function() {
  scraperwiki.exec('mkdir -p code; touch code/query.sql; cat code/query.sql', function(data) {
    data = data.replace(/\s\s*$/, '')
    if (data == "") {
      loaded_empty = true
      use_default_query_if_needed()
    } else {
      editor.setValue(data)
      editor.clearSelection()
      editor.focus()

      scraperwiki.exec('mkdir -p code; touch code/chart.js; cat code/chart.js', function(data) {
        data = data.replace(/\s\s*$/, '')
        if (data == "") {
          // TODO
          //loaded_empty = true
          //use_default_query_if_needed()
        } else {
          c3code.setValue(data)
          c3code.clearSelection()
          c3code.focus()
          run()
          c3code.on('change', real_save_throttled)
        }
      })
    }
  })
}
var use_default_query_if_needed = function() {
  if (meta && loaded_empty) {
    if (editor.getValue() == "") {
      use_default_query()
      run()
      editor.on('change', real_save_throttled)
    }
  }
}
var use_default_query = function() {
  table = Object.keys(meta.table)[0]
  cols = meta.table[table].columnNames
  data = "select \n" +
      "\t" + cols.slice(0, 3).join(",\n\t") + "\n" +
      "from " + table + "\n"
  if (cols.length > 2) {
      data += "-- where " + cols[Math.min(cols.length, 2)] + " > \n" +
	      "order by " + cols[1] + "\n"
  }
  data += "limit 20" + "\n"

  editor.setValue(data)
  editor.clearSelection()
  editor.focus()
}

var show_loading = function() {
  $('#run').addClass('loading').html('Running&hellip;')
}

var show_not_loading = function() {
  $('#run').removeClass('loading').html('Run <i class="icon-arrow-right"></i>')
}

var run = function() {
  console.log("run called")

  show_loading()
  real_run()
}

// http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
String.prototype.hashCode = function(){
    var hash = 0, i, char;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};

var meta = null
var get_meta = function() {
  scraperwiki.sql.meta(function (response) {
    meta = response
    use_default_query_if_needed()

    $.each(response.table, function (table_name, table) {
      var html = '<div class="inserterHit"><h2 class="inserter">' + table_name + '</h2></div> <ul>'
      _.each(table.columnNames, function(colname){
        html += '<li class="inserterHit" id="colhelp' + table_name.hashCode() + colname.hashCode() + '"><span class="inserter">' + colname + '<span></li>'
      })
      html += '</ul>'
      $('#schema').append(html)

      scraperwiki.sql("select * from " + table_name + " order by random() limit 10", function (response) {
        if (!response) {
          return
        }
	//console.log(response)
  	$.each(response[0], function (key, value) {
	  var code = '#colhelp' + table_name.hashCode() + key.hashCode()
	  var txt = "e.g. "
          var examples = []
	  $.each(response, function (ix, row) {
            if (row[key] != null) {
              examples.push("'" + row[key] + "'")
            }
          })
	  txt += _.uniq(examples).join(", ")
	  txt += "</span>"
	  $(code).append(" <span class='example'>" + txt + "</span>")
  	})
       }, function (jqXHR, textStatus, errorThrown) { err("Error getting sample rows", textStatus, true) } )
    })

    var lastCursorPosition = -1
    editor.on('change', function() {
      lastCursorPosition = -1
    })
    $('.inserterHit').click(function() {
      if (JSON.stringify(lastCursorPosition) == JSON.stringify(editor.getCursorPosition())) {
	editor.insert(', ')
      }
      var col_name = $(".inserter", this).text()
      // quote the column name if there are any odd characters in it
      if (/[^A-Za-z0-9_]/.test(col_name))
	col_name = '"' + col_name + '"'
      editor.insert(col_name)
      editor.focus()
      lastCursorPosition = editor.getCursorPosition()
    })
  }, function (jqXHR, textStatus, errorThrown) { err("Error getting schema", textStatus, true) } )
}

$(function() {
  editor = ace.edit("editor")
  editor.setFontSize(16)
  editor.renderer.setShowGutter(false)
  editor.session.setUseWrapMode(true)
  editor.session.setWrapLimitRange(null, null)
  editor.setTheme("ace/theme/clouds")
  editor.getSession().setMode("ace/mode/sql")

  c3code = ace.edit("c3code")
  c3code.setFontSize(16)
  c3code.renderer.setShowGutter(false)
  c3code.session.setUseWrapMode(true)
  c3code.session.setWrapLimitRange(null, null)
  c3code.setTheme("ace/theme/clouds")
  c3code.getSession().setMode("ace/mode/javascript")

  load()
  get_meta()
  $('#run').on('click', run)

  $(document).on('keydown', function(e){
    // the keycode for "enter" is 13
    if((e.ctrlKey || e.metaKey) && e.which==13) {
      run()
      e.preventDefault()
    }
    // eat ctrl+s for save (see https://github.com/frabcus/code-scraper-in-browser-tool/issues/56)
    if ((e.ctrlKey || e.metaKey) && e.which==83) {
      e.preventDefault()
    }
  })
})

