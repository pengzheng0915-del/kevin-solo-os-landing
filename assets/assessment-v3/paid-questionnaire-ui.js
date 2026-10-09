(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinPaidQuestionnaireUI = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function element(documentValue, tag, className, text) {
    var node = documentValue.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function fieldValue(payload, question) {
    if (question.source === 'root') return payload[question.id];
    var bucket = question.source === 'core' ? payload.coreAnswers : payload.branchAnswers;
    return bucket && bucket[question.id];
  }

  function setFieldValue(payload, question, value) {
    if (question.source === 'root') {
      payload[question.id] = value;
      if (question.id === 'caseAvailability') {
        payload.coreAnswers = payload.coreAnswers || {};
        payload.branchAnswers = payload.branchAnswers || {};
        if (value === 'has_case') {
          delete payload.coreAnswers.nearestIncident;
        } else {
          ['caseOneProblem', 'caseOneAction', 'caseOneResult', 'caseBoundaryTransfer'].forEach(function (field) {
            delete payload.coreAnswers[field];
          });
          ['caseCountDetailed', 'evidenceType', 'costWillingnessSignal', 'audienceAccess'].forEach(function (field) {
            delete payload.branchAnswers[field];
          });
        }
      }
      return;
    }
    var key = question.source === 'core' ? 'coreAnswers' : 'branchAnswers';
    if (!payload[key] || typeof payload[key] !== 'object') payload[key] = {};
    payload[key][question.id] = value;
  }

  function optionValue(option) {
    return typeof option === 'string' ? option : option.value;
  }

  function optionLabel(option) {
    return typeof option === 'string' ? option : option.label;
  }

  function stageLabel(stage) {
    return ({
      decision: '本次要判断',
      context: '事实底稿',
      evidence: '证据状态',
      case: '真实经历',
      boundary: '必要边界'
    })[stage] || '深度测评';
  }

  function renderIntroduction(documentValue, container) {
    container.innerHTML = '';
    var article = element(documentValue, 'article', 'paid-questionnaire__surface paid-questionnaire__intro');
    article.appendChild(element(documentValue, 'p', 'paid-questionnaire__meta', '约 10-15 分钟 · 自动保存'));
    article.appendChild(element(documentValue, 'h1', 'paid-questionnaire__title', '个人经验决策测评'));
    article.appendChild(element(documentValue, 'p', 'paid-questionnaire__promise', '不是给你打分，是帮你判断下一步'));

    var steps = element(documentValue, 'ol', 'paid-questionnaire__steps');
    [
      ['快速定位', '梳理关键经历，认清当前位置'],
      ['核验证据', '基于真实经历，分析可迁移能力'],
      ['生成行动', '给出可以执行的下一步建议']
    ].forEach(function (item) {
      var row = element(documentValue, 'li', 'paid-questionnaire__step');
      row.appendChild(element(documentValue, 'strong', '', item[0]));
      row.appendChild(element(documentValue, 'span', '', item[1]));
      steps.appendChild(row);
    });
    article.appendChild(steps);
    article.appendChild(element(documentValue, 'p', 'paid-questionnaire__assurance', '没有标准答案；暂时不知道，可以如实选择。'));
    var start = element(documentValue, 'button', 'paid-questionnaire__action paid-questionnaire__action--primary', '开始测评');
    start.type = 'button';
    article.appendChild(start);
    container.appendChild(article);
  }

  function mount(options) {
    var value = options || {};
    if (!value.container || !value.container.ownerDocument) throw new TypeError('questionnaire container is required');
    if (!value.model || typeof value.model.getVisibleQuestions !== 'function') throw new TypeError('questionnaire model is required');
    var documentValue = value.container.ownerDocument;
    var payload = clone(value.initialPayload);
    payload.questionnaireRevision = value.model.REVISION;
    payload.coreAnswers = payload.coreAnswers || {};
    payload.branchAnswers = payload.branchAnswers || {};
    var initialQuestions = value.model.getVisibleQuestions(payload);
    var hasProgress = initialQuestions.some(function (question) {
      return value.model.answerState(fieldValue(payload, question)) !== 'missing';
    });
    var initialValidation = value.model.canFinalize(payload);
    var state = {
      screen: !hasProgress ? 'intro' : (initialValidation.pass ? 'review' : 'question'),
      questionId: initialValidation.firstMissing || 'decision',
      saveState: '自动保存'
    };

    function notifyChange() {
      if (typeof value.onChange === 'function') value.onChange(clone(payload));
    }

    function renderQuestion() {
      var questions = value.model.getVisibleQuestions(payload);
      var question = questions.find(function (item) { return item.id === state.questionId; }) || questions[0];
      state.questionId = question.id;
      var inStage = questions.filter(function (item) { return item.stage === question.stage; });
      var stageIndex = inStage.findIndex(function (item) { return item.id === question.id; }) + 1;
      var article = element(documentValue, 'article', 'paid-questionnaire__surface paid-questionnaire__question');
      article.setAttribute('data-question-id', question.id);

      var top = element(documentValue, 'div', 'paid-questionnaire__topline');
      top.appendChild(element(documentValue, 'span', 'paid-questionnaire__progress', stageLabel(question.stage) + ' ' + stageIndex + ' / ' + inStage.length));
      var save = element(documentValue, 'span', 'paid-questionnaire__save', state.saveState);
      save.setAttribute('role', 'status');
      top.appendChild(save);
      article.appendChild(top);
      article.appendChild(element(documentValue, 'h1', 'paid-questionnaire__question-title', question.label));
      article.appendChild(element(documentValue, 'p', 'paid-questionnaire__question-help', question.help));

      if (question.sentenceStarter) {
        article.appendChild(element(documentValue, 'p', 'paid-questionnaire__starter', '可以接着这句话写：' + question.sentenceStarter));
      }
      if (Array.isArray(question.factChecks) && question.factChecks.length) {
        var checks = element(documentValue, 'ul', 'paid-questionnaire__checks');
        question.factChecks.forEach(function (item) { checks.appendChild(element(documentValue, 'li', '', item)); });
        article.appendChild(checks);
      }

      var control = element(documentValue, 'div', 'paid-questionnaire__control');
      if (question.type === 'textarea') {
        var label = element(documentValue, 'label', 'paid-questionnaire__label', '你的回答');
        label.setAttribute('for', 'paid-questionnaire-' + question.id);
        control.appendChild(label);
        var textarea = element(documentValue, 'textarea', 'paid-questionnaire__textarea');
        textarea.id = 'paid-questionnaire-' + question.id;
        textarea.rows = question.id === 'decision' ? 4 : 6;
        textarea.maxLength = 1400;
        textarea.value = fieldValue(payload, question) || '';
        control.appendChild(textarea);
      } else {
        var optionsRow = element(documentValue, 'div', 'paid-questionnaire__options');
        (question.options || []).forEach(function (option) {
          var optionButton = element(documentValue, 'button', 'paid-questionnaire__option');
          optionButton.type = 'button';
          optionButton.setAttribute('aria-label', optionLabel(option));
          optionButton.setAttribute('aria-pressed', fieldValue(payload, question) === optionValue(option) ? 'true' : 'false');
          optionButton.appendChild(element(documentValue, 'strong', '', optionLabel(option)));
          if (typeof option === 'object' && option.detail) optionButton.appendChild(element(documentValue, 'span', '', option.detail));
          optionsRow.appendChild(optionButton);
        });
        control.appendChild(optionsRow);
      }
      article.appendChild(control);
      article.appendChild(element(documentValue, 'p', 'paid-questionnaire__effect', '这项回答会影响：' + question.affects));

      var nav = element(documentValue, 'div', 'paid-questionnaire__nav');
      var back = element(documentValue, 'button', 'paid-questionnaire__action paid-questionnaire__action--secondary', '返回');
      back.type = 'button';
      var next = element(documentValue, 'button', 'paid-questionnaire__action paid-questionnaire__action--primary', '继续');
      next.type = 'button';
      next.disabled = value.model.answerState(fieldValue(payload, question)) === 'missing';
      nav.appendChild(back);
      nav.appendChild(next);
      article.appendChild(nav);

      var error = element(documentValue, 'p', 'paid-questionnaire__error');
      error.setAttribute('role', 'alert');
      article.appendChild(error);
      value.container.innerHTML = '';
      value.container.appendChild(article);

      var textareaNode = article.querySelector('textarea');
      if (textareaNode) {
        textareaNode.addEventListener('input', function () {
          setFieldValue(payload, question, textareaNode.value);
          next.disabled = value.model.answerState(textareaNode.value) === 'missing';
          error.textContent = '';
          notifyChange();
        });
      }
      Array.prototype.forEach.call(article.querySelectorAll('.paid-questionnaire__option'), function (button, index) {
        button.addEventListener('click', function () {
          setFieldValue(payload, question, optionValue(question.options[index]));
          Array.prototype.forEach.call(article.querySelectorAll('.paid-questionnaire__option'), function (item) {
            item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
          });
          next.disabled = false;
          error.textContent = '';
          notifyChange();
        });
      });
      back.addEventListener('click', function () {
        var currentQuestions = value.model.getVisibleQuestions(payload);
        var currentIndex = currentQuestions.findIndex(function (item) { return item.id === question.id; });
        if (currentIndex <= 0) state.screen = 'intro';
        else state.questionId = currentQuestions[currentIndex - 1].id;
        render();
      });
      next.addEventListener('click', function () {
        if (value.model.answerState(fieldValue(payload, question)) === 'missing') {
          error.textContent = '请先完成当前回答。';
          return;
        }
        var currentQuestions = value.model.getVisibleQuestions(payload);
        var currentIndex = currentQuestions.findIndex(function (item) { return item.id === question.id; });
        if (currentIndex >= currentQuestions.length - 1) state.screen = 'review';
        else state.questionId = currentQuestions[currentIndex + 1].id;
        render();
      });
    }

    function renderReview() {
      var article = element(documentValue, 'article', 'paid-questionnaire__surface paid-questionnaire__review');
      article.appendChild(element(documentValue, 'p', 'paid-questionnaire__meta', '提交前复核'));
      article.appendChild(element(documentValue, 'h1', 'paid-questionnaire__question-title', '确认并锁定本次测评'));
      article.appendChild(element(documentValue, 'p', 'paid-questionnaire__question-help', '请检查以下内容，确认无误后再提交。'));

      var review = value.model.buildReview(payload);
      var reviewBody = element(documentValue, 'div', 'paid-questionnaire__review-body');
      review.forEach(function (section) {
        var group = element(documentValue, 'details', 'paid-questionnaire__review-section');
        group.setAttribute('data-review-section', section.id);
        if (section.id === 'decision') group.open = true;
        var summary = element(documentValue, 'summary', 'paid-questionnaire__review-summary');
        summary.appendChild(element(documentValue, 'h2', '', section.title));
        var countLabel = section.items.length
          ? section.items.length + (section.id === 'evidence' ? ' 项事实' : section.id === 'constraints' ? ' 项条件' : ' 项')
          : '本次无新增项';
        summary.appendChild(element(documentValue, 'span', '', countLabel));
        group.appendChild(summary);
        if (!section.items.length) {
          group.appendChild(element(documentValue, 'p', 'paid-questionnaire__review-empty', section.id === 'unknown'
            ? '本次没有额外声明的未知项。'
            : '本次没有可展示的内容。'));
        }
        section.items.forEach(function (item) {
          var row = element(documentValue, 'button', 'paid-questionnaire__review-row');
          row.type = 'button';
          row.setAttribute('data-edit-field', item.field);
          row.setAttribute('aria-label', '修改：' + item.label);
          row.appendChild(element(documentValue, 'strong', '', item.label));
          row.appendChild(element(documentValue, 'span', '', item.value));
          row.addEventListener('click', function () {
            state.screen = 'question';
            state.questionId = item.field;
            render();
          });
          group.appendChild(row);
        });
        reviewBody.appendChild(group);
      });
      article.appendChild(reviewBody);
      article.appendChild(element(documentValue, 'p', 'paid-questionnaire__lock-note', '提交后，报告只基于本次材料生成。'));

      var confirm = element(documentValue, 'button', 'paid-questionnaire__action paid-questionnaire__action--final', '确认并生成报告');
      confirm.type = 'button';
      var error = element(documentValue, 'p', 'paid-questionnaire__error');
      error.setAttribute('role', 'alert');
      confirm.addEventListener('click', function () {
        var validation = value.model.canFinalize(payload);
        if (!validation.pass) {
          state.screen = 'question';
          state.questionId = validation.firstMissing;
          render();
          return;
        }
        if (typeof value.onFinalize !== 'function') return;
        confirm.disabled = true;
        state.saveState = '正在提交';
        Promise.resolve(value.onFinalize(clone(payload))).catch(function () {
          confirm.disabled = false;
          state.saveState = '提交未完成';
          error.textContent = '暂时未能提交，已填写内容仍保留，请重试。';
        });
      });
      article.appendChild(confirm);
      article.appendChild(error);
      value.container.innerHTML = '';
      value.container.appendChild(article);
    }

    function render() {
      if (state.screen === 'intro') {
        renderIntroduction(documentValue, value.container);
        value.container.querySelector('.paid-questionnaire__action--primary').addEventListener('click', function () {
          state.screen = 'question';
          state.questionId = 'decision';
          render();
          var input = value.container.querySelector('textarea');
          if (input) input.focus();
        });
        return;
      }
      if (state.screen === 'review') {
        renderReview();
        return;
      }
      renderQuestion();
    }

    value.container.hidden = false;
    value.container.classList.add('is-mounted');
    render();
    return {
      snapshot: function () { return clone(payload); },
      focusField: function (field) {
        if (!value.model.getVisibleQuestions(payload).some(function (question) { return question.id === field; })) return false;
        state.screen = 'question';
        state.questionId = field;
        render();
        var input = value.container.querySelector('textarea');
        if (input) input.focus();
        return true;
      },
      setSaveState: function (nextState) {
        state.saveState = ({ saving: '正在保存', saved: '已保存', failed: '保存未完成' })[nextState] || '自动保存';
        var node = value.container.querySelector('.paid-questionnaire__save');
        if (node) node.textContent = state.saveState;
      },
      destroy: function () {
        value.container.innerHTML = '';
        value.container.hidden = true;
        value.container.classList.remove('is-mounted');
      }
    };
  }

  return { mount: mount };
}));
