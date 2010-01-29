(function($) {

  function Session() {

    function doLogin(username, password, callback) {
      $.couch.login({
        username : username,
        password : password,
        success : function() {
          $.futon.session.sidebar();
          callback();
        },
        error : function(code, error, reason) {
          $.futon.session.sidebar();
          callback({username : "Error logging in: "+reason});
        }
      });
    }

    function doSignup(username, password, callback, runLogin) {
      $.couch.signup({
        username : username
      }, password, {
        success : function() {
          if (runLogin) {
            doLogin(username, password, callback);
          } else {
            callback();
          }
        },
        error : function(status, error, reason) {
          $.futon.session.sidebar();
          if (error = "conflict") {
            callback({username : "Name '"+username+"' is taken"});
          } else {
            callback({username : "Signup error:  "+reason});
          }
        }
      });
    }

    function validateUsernameAndPassword(data, callback) {
      if (!data.username || data.username.length == 0) {
        callback({username: "Please enter a username."});
        return false;
      }
      if (!data.password || data.password.length == 0) {
        callback({password: "Please enter a password."});
        return false;
      }
      return true;
    }

    function createAdmin() {
      $.showDialog("dialog/create_admin.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          $.couch.config({
            success : function() {
              callback();
              doLogin(data.username, data.password, callback);
              doSignup(data.username, null, callback, false);
            }
          }, "admins", data.username, data.password);
        }
      });
      return false;
    }

    function login() {
      $.showDialog("dialog/login.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          doLogin(data.username, data.password, callback);
        }
      });
      return false;
    }

    function logout() {
      $.couch.logout({
        success : function(resp) {
          $.futon.session.sidebar();
        }
      })
    }

    function signup() {
      $.showDialog("dialog/signup.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          doSignup(data.username, data.password, callback, true);
        }
      });
      return false;
    }

    this.setupSidebar = function() {
      $("#userCtx .login").click(login);
      $("#userCtx .logout").click(logout);
      $("#userCtx .signup").click(signup);
      $("#userCtx .createadmin").click(createAdmin);
    };

    this.sidebar = function() {
      // get users db info?
      $("#userCtx span").hide();
      $.couch.session({
        success : function(userCtx) {
          if (userCtx.name) {
            $("#userCtx .username").text(userCtx.name);
            if (userCtx.roles.indexOf("_admin") != -1) {
              $("#userCtx .loggedinadmin").show();
            } else {
              $("#userCtx .loggedin").show();
            }
          } else if (userCtx.roles.indexOf("_admin") != -1) {
            $("#userCtx .adminparty").show();
          } else {
            $("#userCtx .loggedout").show();
          }
        }
      })
    };
  }

  function Storage() {
    var storage = this;
    this.decls = {};

    this.declare = function(name, options) {
      this.decls[name] = $.extend({}, {
        scope: "window",
        defaultValue: null,
        prefix: ""
      }, options || {});
    };

    this.declareWithPrefix = function(prefix, decls) {
      for (var name in decls) {
        var options = decls[name];
        options.prefix = prefix;
        storage.declare(name, options);
      }
    };

    this.del = function(name) {
      lookup(name, function(decl) {
        handlers[decl.scope].del(decl.prefix + name);
      });
    };

    this.get = function(name, defaultValue) {
      return lookup(name, function(decl) {
        var value = handlers[decl.scope].get(decl.prefix + name);
        if (value !== undefined) {
          return value;
        }
        if (defaultValue !== undefined) {
          return defaultValue;
        }
        return decl.defaultValue;
      });
    };

    this.set = function(name, value) {
      lookup(name, function(decl) {
        if (value == decl.defaultValue) {
          handlers[decl.scope].del(decl.prefix + name);
        } else {
          handlers[decl.scope].set(decl.prefix + name, value);
        }
      });
    };

    function lookup(name, callback) {
      var decl = storage.decls[name];
      if (decl === undefined) {
        return decl;
      }
      return callback(decl);
    }

    var handlers = {

      "cookie": {
        get: function(name) {
          var nameEq = name + "=";
          var parts = document.cookie.split(';');
          for (var i = 0; i < parts.length; i++) {
            var part = parts[i].replace(/^\s+/, "");
            if (part.indexOf(nameEq) == 0) {
              return unescape(part.substring(nameEq.length, part.length));
            }
          }
        },
        set: function(name, value) {
          var date = new Date();
          date.setTime(date.getTime() + 14*24*60*60*1000); // two weeks
          document.cookie = name + "=" + escape(value) + "; expires=" +
            date.toGMTString();
        },
        del: function(name) {
          var date = new Date();
          date.setTime(date.getTime() - 24*60*60*1000); // yesterday
          document.cookie = name + "=; expires=" + date.toGMTString();
        }
      },

      "window": {
        get: function(name) {
          return JSON.parse(window.name || "{}")[name];
        },
        set: function(name, value) {
          var obj = JSON.parse(window.name || "{}");
          obj[name] = value || null;
          window.name = JSON.stringify(obj);
        },
        del: function(name) {
          var obj = JSON.parse(window.name || "{}");
          delete obj[name];
          window.name = JSON.stringify(obj);
        }
      }
    };
  }

  $.futon = $.futon || {};
  $.extend($.futon, {
    session : new Session(),
    storage: new Storage()
  });

  $.fn.addPlaceholder = function(text) {
    return this.each(function() {
      var input = $(this);
      if ($.browser.safari) {
        input.attr("placeholder", text);
        return;
      }
      input.blur(function() {
        if ($.trim(input.val()) == "") {
          input.addClass("placeholder").val(text);
        } else {
          input.removeClass("placeholder");
        }
      }).triggerHandler("blur");
      input.focus(function() {
        if (input.is(".placeholder")) {
          input.val("").removeClass("placeholder");
        }
      });
      $(this.form).submit(function() {
        if (input.is(".placeholder")) {
          input.val("");
        }
      });
    });
  };

  $.fn.enableTabInsertion = function(chars) {
    chars = chars || "\t";
    var width = chars.length;
    return this.keydown(function(evt) {
      if (evt.keyCode == 9) {
        var v = this.value;
        var start = this.selectionStart;
        var scrollTop = this.scrollTop;
        if (start !== undefined) {
          this.value = v.slice(0, start) + chars + v.slice(start);
          this.selectionStart = this.selectionEnd = start + width;
        } else {
          document.selection.createRange().text = chars;
          this.caretPos += width;
        }
        return false;
      }
    });
  };

  $(document)
    .ajaxStart(function() { $(this.body).addClass("loading"); })
    .ajaxStop(function() { $(this.body).removeClass("loading"); });

  $.futon.storage.declare("sidebar", {scope: "cookie", defaultValue: "show"});
  $.futon.storage.declare("recent", {scope: "cookie", defaultValue: ""});

  $(function() {
    document.title = "CouchApp User Authentication Demo: " + document.title;
    $.get("sidebar.html", function(resp) {
      $("#wrap").append(resp);

      $.futon.session.setupSidebar();
      $.futon.session.sidebar();

      $.couch.info({
        success: function(info, status) {
          $("#version").text(info.version);
        }
      });

    });
  });

})(jQuery);
