window.__ModuleLoader__.load({
  id: '@local/dsh-web-filebrowser',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    /** Locale namespace owned by this plugin. */
    const NS = 'dsh-web-filebrowser'

    /** Right-sidebar tab-type identity and kind for the guide entry. */
    const IDE_ID = '@local/dsh-web-filebrowser'
    const IDE_KIND = 'dsh-web-filebrowser'

    /** Public repository shown by the update prompt. */
    const GITHUB_URL = 'https://github.com/taskkill/dsh-web-filebrowser'

    /** Absolute route below `/api` served by the Host half. */
    const API_PATH = 'api/dsh-web-filebrowser'

    /** Binary upload/download companion route (host bridge bundle). */
    const IO_PATH = 'api/dsh-web-filebrowser-io'
    const MAX_UPLOAD_BYTES = 128 * 1024 * 1024

    /** Local Git companion route (host bridge bundle). */
    const GIT_PATH = 'api/dsh-web-filebrowser-git'

    /** Locale-store keys. */
    const ROOT_KEY = 'dsh-web-filebrowser:root'
    const WIDTH_KEY = 'dsh-web-filebrowser:tree-width'
    const SIDE_POSITION_KEY = 'dsh-web-filebrowser:side-position'
    const HIDDEN_KEY = 'dsh-web-filebrowser:show-hidden'
    const FAVORITES_KEY = 'dsh-web-filebrowser:favorites'
    const FAVORITES_OPEN_KEY = 'dsh-web-filebrowser:favorites-open'
    const HIDDEN_ROOTS_KEY = 'dsh-web-filebrowser:hidden-roots'
    const WRAP_KEY = 'dsh-web-filebrowser:word-wrap'
    const DRAG_TYPE = 'application/x-dsh-web-filebrowser-path'
    const SSH_ROOTS_KEY = 'dsh-web-filebrowser:ssh-roots'
    const SSH_UPLOAD_PATH = 'api/dsh-web-filebrowser-ssh'

    /** Host-side HTML proxy for public preview pages. */
    const PROXY_PATH = 'api/dsh-web-filebrowser-proxy'

    /** Local terminal session/asset route. */
    const TERMINAL_PATH = 'api/dsh-web-filebrowser-terminal'

    /** Session-scoped child seats that render the current DeepSeek conversation. */
    const CHAT_INLINE_SLOT = 'dsh-web-filebrowser.chat.inline'
    const CHAT_SIDEBAR_INLINE_SLOT = 'dsh-web-filebrowser.chat.inline.sidebar'

    /** Legacy right-sidebar chat page; kept so saved layouts keep rendering. */
    const CHAT_TAB_ID = '@local/dsh-web-filebrowser/chat'
    const CHAT_TAB_KIND = 'dsh-web-filebrowser-chat'
    const CHAT_CONTENT_SLOT = 'dsh-web-filebrowser.chat.conversation'

    /** Suggested local dev-server ports when /proc port scanning is unavailable. */
    const BROWSER_COMMON_PORTS = [3000, 5173, 8080, 8000, 4173, 4321, 8888]

    /** Device presets for the mobile preview viewport. */
    const BROWSER_DEVICES = {
      iphone14: { label: 'iPhone 14', width: 390, height: 844 },
      iphoneSE: { label: 'iPhone SE', width: 375, height: 667 },
      pixel7: { label: 'Pixel 7', width: 412, height: 915 },
      ipad: { label: 'iPad', width: 768, height: 1024 },
    }

    /** Remember the last PC/mobile viewport choice. */
    const BROWSER_VIEW_KEY = 'dsh-web-filebrowser:browser-view'

    /** Hostname used for all detected/common port shortcuts. */
    const PREVIEW_HOST_KEY = 'dsh-web-filebrowser:preview-host'
    const PREVIEW_SCHEME_KEY = 'dsh-web-filebrowser:preview-scheme'

    function normalizePreviewScheme(value) {
      return value === 'http' || value === 'https' ? value : 'auto'
    }

    function previewPortScheme(scheme, port) {
      const normalized = normalizePreviewScheme(scheme)
      if (normalized !== 'auto') return normalized
      return port === 443 || port === 8443 ? 'https' : 'http'
    }

    function normalizePreviewHost(value) {
      let host = typeof value === 'string' ? value.trim() : ''
      if (host.length === 0) return 'localhost'
      if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(host)) {
        try {
          host = new URL(host).hostname
        } catch {
          return 'localhost'
        }
      }
      if (host.startsWith('[')) {
        const end = host.indexOf(']')
        return end > 0 ? host.slice(0, end + 1) : 'localhost'
      }
      const slash = host.indexOf('/')
      if (slash >= 0) host = host.slice(0, slash)
      if (/^[^:]+:\d+$/u.test(host)) host = host.slice(0, host.lastIndexOf(':'))
      return host.length > 0 ? host : 'localhost'
    }

    function browserDeviceSize(tab) {
      const preset = BROWSER_DEVICES[tab.mobilePreset] ?? BROWSER_DEVICES.iphone14
      return tab.orientation === 'landscape'
        ? { width: preset.height, height: preset.width, label: preset.label }
        : { width: preset.width, height: preset.height, label: preset.label }
    }

    /**
     * Copy preferences saved under the old prefix to the new
     * dsh-web-filebrowser keys. Existing new keys win; old keys are left in
     * place so a downgrade still sees them.
     */
    function migrateLegacyStorage() {
      const legacyPrefix = 'dsh-side:'
      const currentPrefix = 'dsh-web-filebrowser:'
      const keys = [ROOT_KEY, WIDTH_KEY, HIDDEN_KEY, FAVORITES_KEY, FAVORITES_OPEN_KEY, HIDDEN_ROOTS_KEY, WRAP_KEY, SSH_ROOTS_KEY]
      try {
        for (const key of keys) {
          const legacy = legacyPrefix + key.slice(currentPrefix.length)
          const value = window.localStorage.getItem(legacy)
          if (value !== null && window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value)
        }
      } catch {
        /* private mode or disabled localStorage: preferences start empty */
      }
    }

    migrateLegacyStorage()

    /** Stable empty list for a slot without the workspaces hook. */
    const EMPTY_WORKSPACES = []

    /* ------------------------------------------------------------------ *
     * Dictionaries
     * ------------------------------------------------------------------ */

    const zh = {
      'panel.title': '文件工作区',
      'terminal.toggle': '终端',
      'terminal.open': '打开终端',
      'terminal.title': '终端 {n}',
      'terminal.label': '终端',
      'terminal.loading': '正在启动终端…',
      'terminal.exited': '进程已退出；关闭标签可结束会话',
      'terminal.openFailed': '打开终端失败：{message}',
      'terminal.needRoot': '请先选择工作区再打开终端',
      'terminal.sshUnsupported': 'SSH 远程工作区暂不支持本地终端',
      'terminal.moveToPanel': '移到下方',
      'terminal.moveToEditor': '在编辑区打开',
      'terminal.close': '关闭终端',
      'terminal.closePanel': '关闭终端面板',
      'terminal.new': '新建终端',
      'terminal.tabs': '终端标签',
      'terminal.resize': '拖动调整终端高度',
      'terminal.empty': '没有终端',
      'terminal.local': '本地终端',
      'terminal.quick': '快捷命令',
      'terminal.commandPlaceholder': '输入或选择命令…',
      'terminal.run': '运行',
      'terminal.commandsEmpty': '未检测到常用命令，可直接输入',
      'terminal.refreshCommands': '刷新项目命令',
      'chat.title': 'DeepSeek 对话',
      'chat.openFloating': '在悬浮窗口中打开当前对话',
      'chat.close': '关闭悬浮对话',
      'chat.collapse': '收起对话',
      'chat.expand': '展开对话',
      'chat.new': '新建对话',
      'chat.creating': '正在新建对话…',
      'chat.created': '已创建新对话',
      'chat.current': '当前对话',
      'chat.switch': '切换对话',
      'chat.switchFailed': '切换对话失败：{message}',
      'chat.untitled': '未命名对话',
      'chat.createFailed': '新建对话失败：{message}',
      'chat.createUnavailable': '当前界面不支持新建对话',
      'chat.createSshUnsupported': 'SSH 远程工作区暂不支持新建对话',
      'chat.resize': '拖动调整对话窗口大小',
      'chat.noSession': '当前没有可显示的对话',
      'agent.open': '交给 DeepSeek',
      'agent.short': 'Agent',
      'agent.title': '交给 DeepSeek',
      'agent.hint': '选择代码后可让 DeepSeek 解释、修复或编写测试；未选中时默认使用整个文件。',
      'agent.selection': '选中第 {start}-{end} 行',
      'agent.fileOnly': '整个文件',
      'agent.explain': '解释选中代码',
      'agent.fix': '修复选中代码',
      'agent.tests': '为选中代码写测试',
      'agent.file': '解释当前文件',
      'agent.send': '发送到对话',
      'agent.emptySelection': '请先在编辑器里选中一段代码',
      'agent.sent': '已发送到对话',
      'agent.failed': '发送失败：{message}',
      'agent.preview': '将发送的内容',
      'chat.unavailable': '当前界面不支持悬浮对话',
      'terminal.sessionMissing': '终端会话已关闭',
      'panel.description': '浏览工作区目录，编辑代码，预览 Markdown 与 PDF。',
      'guide.title': '代码工作区',
      'guide.description': '浏览并编辑文件，支持代码高亮、Markdown 与 PDF 预览。',
      'compact.back': '返回目录',
      explorer: '资源管理器',
      'side.search': '搜索',
      'side.harness': 'Harness',
      'side.tabs': '侧栏视图',
      'side.moveLeft': '资源管理器移到左侧',
      'side.moveRight': '资源管理器移到右侧',
      'search.placeholder': '在工作区中搜索',
      'search.run': '搜索',
      'search.regex': '正则',
      'search.case': '区分大小写',
      'search.empty': '输入关键字开始搜索',
      'search.noResults': '没有匹配结果',
      'search.results': '{count} 个结果',
      'search.truncated': '结果过多，仅显示前 {count} 条',
      'search.busy': '搜索中…',
      'search.failed': '搜索失败：{message}',
      'search.sshUnsupported': 'SSH 工作区暂不支持全局搜索',
      'search.clear': '清除搜索',
      'palette.files': '快速打开文件',
      'palette.commands': '命令面板',
      'palette.filesPlaceholder': '输入文件名…',
      'palette.commandsPlaceholder': '输入命令…',
      'palette.noFiles': '没有匹配的文件',
      'palette.noCommands': '没有匹配的命令',
      'palette.loading': '加载文件列表…',
      'palette.hint': '↑↓ 选择 · Enter 打开 · Esc 关闭',
      'find.placeholder': '在文件中查找',
      'find.replacePlaceholder': '替换为',
      'find.next': '下一个',
      'find.prev': '上一个',
      'find.case': '区分大小写',
      'find.replace': '替换',
      'find.replaceAll': '全部替换',
      'find.close': '关闭',
      'find.none': '无匹配',
      'harness.loading': '正在读取 Harness 信息…',
      'harness.profile': 'Profile',
      'harness.version': '插件版本',
      'harness.bundles': 'Bundles',
      'harness.dependencies': '依赖',
      'harness.config': '配置',
      'harness.check': '运行检查',
      'harness.checking': '检查中…',
      'harness.checkOk': '检查通过',
      'harness.checkFailed': '检查失败（退出码 {code}）',
      'harness.output': '输出',
      'harness.copy': '复制',
      'harness.closeConfig': '返回',
      'harness.noConfig': '没有可读取的配置文件',
      'harness.failed': '读取失败：{message}',
      favorites: '收藏夹',
      'favorite.add': '收藏',
      'favorite.remove': '取消收藏',
      'favorite.addSelected': '收藏当前选中项',
      'favorite.removeSelected': '取消收藏当前选中项',
      'favorite.empty': '右键文件或目录选择「收藏」，收藏后单击即可直达。',
      'action.newFile': '新建文件',
      'action.newFolder': '新建文件夹',
      'action.refresh': '刷新',
      'action.refreshRoots': '刷新工作区列表',
      'action.collapseAll': '全部收起',
      'action.showHidden': '显示隐藏文件',
      'action.hideHidden': '隐藏隐藏文件',
      'address.placeholder': '输入路径直达：/数据目录 或 src/lib',
      'action.go': '直达',
      'action.save': '保存',
      'action.reload': '重新加载',
      'action.overwrite': '强制覆盖',
      'action.open': '打开',
      'action.openInBrowser': '在浏览器中打开',
      'action.maximize': '最大化编辑区',
      'action.restore': '还原布局',
      'action.rename': '重命名',
      'action.delete': '删除',
      'action.copyPath': '复制相对路径',
      'action.copyAbsolutePath': '复制绝对路径',
      'action.copy': '复制',
      'action.cut': '剪切',
      'action.paste': '粘贴',
      'action.pasteHere': '粘贴到此目录',
      'action.copyAll': '复制全文',
      'action.upload': '上传文件',
      'action.uploadHere': '上传文件到此处',
      'action.uploading': '正在上传…',
      'action.download': '下载文件',
      'action.downloadShort': '下载',
      'action.copyShort': '复制',
      'action.jumpRoot': '定位到当前工作区根目录（Alt+Home）',
      'action.removeWorkspace': '移除工作区',
      'action.remove': '移除',
      'workspace.pickTitle': '切换或管理工作区',
      'action.wrap': '自动换行',
      'action.wrapShort': '换行',
      'action.nowrap': '取消换行',
      'action.cancel': '取消',
      'action.ok': '知道了',
      'action.discard': '放弃更改',
      'action.preview': '预览',
      'action.edit': '编辑',
      'action.split': '分屏',
      'action.splitExit': '退出分屏',
      'action.retry': '重试',
      'action.newFileHere': '在此新建文件',
      'action.newFolderHere': '在此新建文件夹',
      'menu.refreshFolder': '刷新此目录',
      'workspace.label': '工作区',
      'ssh.add': '添加 SSH 远程…',
      'ssh.title': '添加 SSH 远程目录',
      'ssh.hint': '填写 ssh://user@host:port/绝对路径。默认使用 SSH agent 或 ~/.ssh 下的私钥；也可输入一次性密码。',
      'ssh.password': '密码（可选，仅用于本次连接）',
      'ssh.passwordHint': '密码只用于建立当前 SSH 连接，不会写入磁盘；连接断开后需要重新输入。',
      'ssh.enterPassword': '输入密码',
      'ssh.badSpec': 'SSH 地址无效，应形如 ssh://user@host:22/var/www',
      'ssh.notDirectory': '该路径不是远程目录',
      'ssh.test': '测试连接',
      'ssh.testing': '测试中…',
      'ssh.connect': '连接并添加',
      'ssh.checked': '连接成功：{name}',
      'ssh.connectFailed': '连接 SSH 失败：{message}',
      'version.checkTitle': '检查插件更新',
      'version.checking': '检查中…',
      'version.latest': '已是最新版本 v{version}',
      'version.updateTitle': '发现新版本 v{latest}',
      'version.updateMessage': '当前版本 v{current}，最新版本 v{latest}。本地加载请在插件仓库执行 git pull 后重启 DSH；插件管理器安装请在“设置 → 插件”中卸载后重新安装。GitHub 仓库：https://github.com/taskkill/dsh-web-filebrowser',
      'version.openGithub': '打开 GitHub',
      'version.localUpdate': '本地加载：更新仓库',
      'version.pluginInstall': '插件管理器：安装（已安装则先卸载）',
      'version.updateNow': '立即更新',
      'version.updating': '正在更新…',
      'version.updateDone': '更新完成',
      'version.updateNoChange': '已是最新版本',
      'version.updateRestart': '更新已应用。请重启 DSH 使 Host 代码生效，然后刷新页面；如果依赖有变化，重启前先运行 npm install。',
      'version.updateNoChangeMessage': '当前仓库没有新的提交。',
      'version.updateFailed': '更新失败',
      'version.updateOutput': '更新输出',
      'version.checkFailed': '检查更新失败：{message}',
      welcomeTitle: '文件工作区',
      welcomeHint: '在左侧资源管理器中浏览目录。单击文件即可打开，单击目录选中，双击目录展开或收起。',
      welcomeShortcuts: '⌘/Ctrl + S 保存 · F2 重命名 · Delete 删除',
      welcomeNewFile: '新建第一个文件',
      'hint.loading': '正在读取…',
      'hint.empty': '空目录',
      'hint.hiddenOnly': '只有隐藏文件，点击眼睛图标可显示。',
      'hint.noRoot': '当前没有可用的工作区目录。',
      'hint.noRootAction': '请在 Harness 中打开或新建一个工作区后重试。',
      'hint.noFile': '从左侧选择一个文件开始编辑。',
      'hint.binary': '这是二进制文件，编辑器无法以文本方式打开。',
      'hint.tooLarge': '文件太大，编辑器没有打开它。',
      'hint.pdf': 'PDF 预览',
      'hint.image': '图片预览',
      'hint.dirtyClose': '这个文件有未保存的更改。',
      'hint.unsaved': '未保存',
      'hint.saved': '已保存',
      'hint.loadingFile': '正在读取文件…',
      'hint.preview': 'Markdown 预览',
      'hint.other': '其他',
      'status.encoding': 'UTF-8',
      'browser.open': '内置浏览器',
      'browser.newTab': '新浏览器标签',
      'browser.back': '后退',
      'browser.forward': '前进',
      'browser.reload': '刷新',
      'browser.address': '地址',
      'browser.placeholder': '输入 localhost:5173 或 https://…',
      'browser.host': '主机',
      'browser.scheme': '协议',
      'browser.schemeAuto': '自动',
      'browser.hostHint': '端口快捷方式统一使用此协议和主机',
      'browser.hostReset': '重置为 localhost',
      'browser.resetDefaults': '重置',
      'browser.openExternal': '在外部浏览器打开',
      'browser.badUrl': '只支持 http/https 地址',
      'browser.startTitle': '预览运行中的页面',
      'browser.startHint': '在地址栏输入开发服务器地址并回车，或直接点下面的本地端口。',
      'browser.detected': '检测到的本地端口',
      'browser.rescan': '重新检测',
      'browser.viewport': '预览视口',
      'browser.pc': 'PC',
      'browser.mobile': '手机',
      'browser.direct': '直连',
      'browser.proxy': '代理',
      'browser.proxyHint': '直连失败（拒绝连接）时切换到代理；代理不携带 Cookie/登录态，SPA 或复杂页面可能显示不完整',
      'browser.pcHint': '按当前面板宽度预览',
      'browser.mobileHint': '固定手机宽度预览；仅模拟视口，不模拟触摸和 User-Agent',
      'browser.device': '设备尺寸',
      'browser.rotate': '横竖屏切换',
      'browser.scanning': '正在检测端口…',
      'browser.noPorts': '没有检测到本地端口，可以直接输入地址。',
      'browser.scanUnsupported': '当前平台不支持端口自动检测，可以直接输入地址。',
      'browser.common': '常用端口',
      'browser.startFooter': '本地开发服务器和公网页面默认直连内嵌；若公网页面显示空白或「拒绝连接」，点工具栏「代理」重试。代理不携带 Cookie/登录态，SPA 可能不完整，必要时请用外部浏览器。',
      'browser.sameOrigin': '不能内嵌 Harness 自身页面',
      'browser.sameOriginHint': '该地址与当前 Harness 页面同源，嵌入会有点击劫持风险；请在外部浏览器打开。',
      'browser.mixed': '当前页面是 HTTPS，HTTP 预览可能被浏览器拦截；如空白请用外部浏览器打开。',
      'status.lines': '{count} 行',
      'status.cursor': '第 {line} 行，第 {column} 列',
      'error.roots': '读取工作区列表失败：{message}',
      'error.list': '读取目录失败：{message}',
      'error.pathNotFound': '找不到路径：{path}',
      'error.notDirectoryPath': '{path} 不是目录',
      'error.openRootFailed': '打开目录失败：{message}',
      'error.removeWorkspaceFailed': '移除工作区失败：{message}',
      'error.workspaceRecord': '没有找到这个工作区的记录，请刷新工作区列表后重试。',
      'error.uploadFailed': '上传「{name}」失败：{message}',
      'error.transferFailed': '操作失败：{message}',
      'error.intoItself': '不能把目录移动到它自身内部',
      'error.fileTooLarge': '文件「{name}」超过 {size} 上限，未上传。',
      'error.needRoot': '请先选择或输入一个工作区目录。',
      'error.read': '读取文件失败：{message}',
      'error.saveFailed': '保存失败：{message}',
      'error.createFailed': '创建失败：{message}',
      'error.renameFailed': '重命名失败：{message}',
      'error.deleteFailed': '删除失败：{message}',
      'error.badName': '名称不能包含 “/”、“\\”，也不能是 “.” 或 “..”。',
      'error.nameTaken': '同名文件或目录已存在。',
      'error.notFound': '文件或目录不存在，可能已被移动或删除。',
      'error.outsideRoot': '只能访问工作区内的路径。',
      'error.stale': '磁盘上的文件已被其他程序修改，保存已阻止。',
      'error.tooLarge': '文件超出编辑器的大小上限。',
      'error.binary': '这是二进制文件，无法作为文本编辑。',
      'error.exists': '同名文件或目录已存在。',
      'error.internal': '请求失败：{message}',
      'modal.deleteTitle': '确认删除',
      'modal.deleteFile': '确定删除文件 “{name}” 吗？此操作无法撤销。',
      'modal.deleteFolder': '确定删除文件夹 “{name}” 及其全部内容吗？此操作无法撤销。',
      'modal.dirtyTitle': '未保存的更改',
      'modal.dirtyMessage': '“{name}” 有未保存的更改，关闭后这些更改会丢失。',
      'modal.switchRootTitle': '切换工作区',
      'modal.switchRootMessage': '有未保存的文件。切换工作区会关闭这些文件并丢失更改。',
      'modal.deleteWorkspaceTitle': '移除工作区',
      'modal.deleteWorkspaceMessage': '从工作区列表移除「{name}」（{path}）？不会删除磁盘文件；该工作区下的会话会保留，但不再分组显示。',
      'modal.deleteWorkspaceDirty': '当前工作区有未保存的文件。移除「{name}」（{path}）会关闭这些文件并丢失更改；磁盘文件不会被删除，会话会保留。',
      'modal.hideRootTitle': '从列表移除目录',
      'modal.hideRootMessage': '从当前插件的目录列表隐藏「{name}」（{path}）？不会删除磁盘文件；之后可用地址栏重新打开。',
      'modal.confirmDelete': '删除',
      'toast.saved': '已保存',
      'toast.refreshed': '已刷新',
      'toast.copied': '路径已复制',
      'toast.copyFailed': '无法复制路径',
      'toast.copiedAll': '已复制全文',
      'toast.rootSwitched': '已切换工作区',
      'toast.workspaceRemoved': '已移除工作区',
      'toast.uploading': '正在上传 {count} 个文件…',
      'toast.uploaded': '已上传 {count} 个文件',
      'toast.itemCopied': '已复制「{name}」',
      'toast.itemCut': '已剪切「{name}」',
      'toast.itemMoved': '已移动「{name}」',
      'title.newFile': '新建文件',
      'title.newFolder': '新建文件夹',
      'title.rename': '重命名',
      'title.readError': '无法打开文件',
      'title.preview': '预览',
      'title.edit': '编辑',
      'panel.tooltip': '打开文件工作区',
      'root.none': '没有工作区',
      'markdown.empty': '这个 Markdown 文件是空的。',
      'pdf.open': '在新标签页中打开 PDF',
      'image.open': '在新标签页中打开图片',
      'file.openExternal': '用浏览器打开',
      'git.title': 'Git',
      'git.toggle': 'Git 源代码管理',
      'git.backToFiles': '返回文件树',
      'git.loading': '正在读取 Git 状态…',
      'git.refresh': '刷新 Git 状态',
      'git.noRoot': '先选择一个工作区',
      'git.notRepo': '当前工作区不是 Git 仓库',
      'git.notRoot': '当前目录不是 Git 仓库根目录，请直接打开仓库根目录后再使用 Git。',
      'git.init': '初始化仓库',
      'git.initHint': '初始化后即可暂存、提交和切换分支。',
      'git.branch': '分支',
      'git.switchBranch': '切换分支',
      'git.noBranches': '没有本地分支',
      'git.current': '当前',
      'git.detached': 'HEAD 分离',
      'git.unborn': '尚无提交',
      'git.ahead': '领先 {n}',
      'git.behind': '落后 {n}',
      'git.gone': '上游分支已消失',
      'git.staged': '已暂存的更改',
      'git.changes': '更改',
      'git.history': '提交路线图',
      'git.commitGraph': '提交路线图',
      'git.loadingHistory': '正在读取提交历史…',
      'git.loadingCommit': '正在读取提交…',
      'git.noCommits': '还没有提交',
      'git.commitNoFiles': '该提交没有文件变更',
      'git.mergeCommit': '合并提交（{n} 个父提交）',
      'git.graphTruncated': '仅显示最近 200 条',
      'git.retry': '重试',
      'git.clean': '工作区干净',
      'git.stage': '暂存',
      'git.unstage': '取消暂存',
      'git.stageAll': '全部暂存',
      'git.unstageAll': '全部取消暂存',
      'git.discard': '还原',
      'git.discardTitle': '还原更改',
      'git.discardConfirm': '还原“{path}”在工作区的更改？未暂存的内容会丢失。',
      'git.discardStagedConfirm': '将“{path}”还原到 HEAD 并取消暂存？已暂存和工作区的修改都会丢失。',
      'git.discardUntrackedConfirm': '删除未跟踪文件“{path}”？该文件将从磁盘移除。',
      'git.discardConflictConfirm': '将冲突文件“{path}”还原为 HEAD？当前冲突解决内容会丢失。',
      'git.discardUntrackedHint': '删除未跟踪文件',
      'git.discardConflictHint': '将冲突文件还原为 HEAD',
      'git.discardAll': '全部还原',
      'git.discardAllConfirm': '还原全部 {n} 个更改？未跟踪文件会被删除，且无法恢复。',
      'git.discardOk': '已还原更改',
      'git.commit': '提交',
      'git.committing': '提交中…',
      'git.commitPlaceholder': '提交信息（Ctrl/⌘+Enter 提交）',
      'git.commitEmpty': '请输入提交信息',
      'git.noStaged': '没有已暂存的更改',
      'git.commitOk': '提交成功',
      'git.checkoutOk': '已切换分支',
      'git.initOk': '已初始化 Git 仓库',
      'git.diffStaged': '已暂存',
      'git.diffMode': '差异视图',
      'git.diffSplit': '并排',
      'git.diffSplitHint': '左右并排查看改动',
      'git.diffUnified': '统一',
      'git.diffUnifiedHint': '以统一 diff 查看',
      'git.diffOldSide': '原始',
      'git.diffNewSide': '修改后',
      'git.diffTruncated': '差异过大，仅显示前 {n} 行；切换「统一」可查看完整内容。',
      'git.diffSplitUnavailable': '该差异无法并排显示，已使用统一视图。',
      'git.diffReadOnly': '只读',
      'git.loadingDiff': '正在读取差异…',
      'git.refreshDiff': '刷新差异',
      'git.diffWorking': '工作区',
      'git.untracked': '未跟踪',
      'git.conflict': '冲突',
      'git.noDiff': '没有可显示的差异',
      'git.openFile': '打开文件',
      'git.close': '关闭',
      'git.retry': '重试',
      'git.installHint': 'Git 支持未安装：请安装 @local/dsh-web-filebrowser-git',
      'git.error': 'Git 操作失败',
      'git.busy': '处理中…',
      'git.fetch': '获取',
      'git.fetching': '获取中…',
      'git.fetchHint': '从远程获取引用，不改动工作区',
      'git.fetchOk': '已获取远程更新',
      'git.fetchNone': '已是最新，没有新的远程引用',
      'git.pull': '拉取',
      'git.pulling': '拉取中…',
      'git.pullHint': '以快进方式拉取上游提交',
      'git.pullOk': '已拉取远程更新',
      'git.push': '推送',
      'git.pushing': '推送中…',
      'git.pushHint': '推送当前分支到上游',
      'git.pushOk': '已推送',
      'git.pushSetUpstream': '已推送并设置上游 {upstream}',
      'git.commitAndPush': '提交并推送',
      'git.commitPushOk': '已提交并推送',
      'git.compare': '比较',
      'git.compareHint': '与上游或其他分支比较提交和文件',
      'git.compareTitle': '比较分支',
      'git.compareBase': '基准',
      'git.compareLoading': '正在比较…',
      'git.compareOurs': '仅本地提交',
      'git.compareTheirs': '仅基准提交',
      'git.compareFiles': '更改的文件',
      'git.compareNoDiff': '没有差异',
      'git.compareFailed': '比较失败',
      'git.stash': '储藏',
      'git.stashHint': '储藏当前更改，或应用、弹出、删除已有储藏',
      'git.stashTitle': '储藏',
      'git.stashSave': '储藏当前更改',
      'git.stashSaveHint': '将工作区和暂存区的更改保存为新的储藏。',
      'git.stashSaving': '储藏中…',
      'git.stashMessagePlaceholder': '储藏说明（可选）',
      'git.stashIncludeUntracked': '包含未跟踪文件',
      'git.stashNoChanges': '没有可储藏的更改',
      'git.stashOk': '已储藏当前更改',
      'git.stashEmpty': '还没有储藏记录',
      'git.stashLoading': '正在读取储藏记录…',
      'git.stashApply': '应用',
      'git.stashApplyHint': '应用储藏到工作区，保留储藏记录',
      'git.stashApplyOk': '已应用储藏',
      'git.stashPop': '弹出',
      'git.stashPopHint': '应用储藏并从列表移除',
      'git.stashPopOk': '已弹出储藏',
      'git.stashDrop': '删除储藏',
      'git.stashDropTitle': '删除储藏',
      'git.stashDropConfirm': '删除 {ref}？该储藏将无法恢复。',
      'git.stashDropOk': '已删除储藏',
      'git.stashConflict': '储藏应用冲突或索引无法完整恢复，部分更改可能已写入工作区；请在终端检查冲突，储藏记录仍会保留。',
      'git.noStash': '储藏记录不存在或已被删除。',
      'git.unmerged': '存在未解决的冲突，无法储藏；请先在终端解决冲突。',
      'git.authRequired': '远程仓库要求认证；请在 Host 上配置 SSH 密钥或 Git 凭据助手（本插件不保存凭据）。',
      'git.noRemote': '当前仓库没有配置远程仓库。',
      'git.noUpstream': '当前分支没有上游分支，无法拉取。',
      'git.nonFastForward': '远程有新提交，推送被拒绝；请先拉取或合并。',
      'git.diverged': '本地分支与上游已分叉，无法快进；请先在终端变基或合并。',
      'git.detachedPush': 'HEAD 处于分离状态，无法推送。',
      'git.noCommits': '还没有提交。',
      'git.networkError': '无法连接远程仓库，请检查网络或远程地址。',
      'git.conflictError': '操作产生冲突，请先在终端解决冲突。',
      'git.dirtyError': '工作区有未提交的更改，无法拉取；请先提交或暂存。',
      'git.rejected': '远程仓库拒绝了这次推送。',
    }

    const en = {
      'panel.title': 'Workspace Files',
      'terminal.toggle': 'Terminal',
      'terminal.open': 'Open terminal',
      'terminal.title': 'Terminal {n}',
      'terminal.label': 'Terminal',
      'terminal.loading': 'Starting terminal…',
      'terminal.exited': 'Process exited; close the tab to end the session',
      'terminal.openFailed': 'Could not open terminal: {message}',
      'terminal.needRoot': 'Choose a workspace before opening a terminal',
      'terminal.sshUnsupported': 'Local terminals are not available for SSH workspaces',
      'terminal.moveToPanel': 'Move to panel',
      'terminal.moveToEditor': 'Open in editor',
      'terminal.close': 'Close terminal',
      'terminal.closePanel': 'Close terminal panel',
      'terminal.new': 'New terminal',
      'terminal.tabs': 'Terminal tabs',
      'terminal.resize': 'Drag to resize the terminal',
      'terminal.empty': 'No terminal',
      'terminal.local': 'Local terminal',
      'terminal.quick': 'Quick commands',
      'terminal.commandPlaceholder': 'Type or choose a command…',
      'terminal.run': 'Run',
      'terminal.commandsEmpty': 'No common commands detected; type one directly',
      'terminal.refreshCommands': 'Refresh project commands',
      'chat.title': 'DeepSeek conversation',
      'chat.openFloating': 'Open the current conversation in a floating panel',
      'chat.close': 'Close the floating conversation',
      'chat.collapse': 'Collapse conversation',
      'chat.expand': 'Expand conversation',
      'chat.new': 'New conversation',
      'chat.creating': 'Creating conversation…',
      'chat.created': 'New conversation created',
      'chat.current': 'Current conversation',
      'chat.switch': 'Switch conversation',
      'chat.switchFailed': 'Could not switch conversation: {message}',
      'chat.untitled': 'Untitled conversation',
      'chat.createFailed': 'Could not create a conversation: {message}',
      'chat.createUnavailable': 'Creating a conversation is unavailable in this layout',
      'chat.createSshUnsupported': 'New conversations are not available for SSH workspaces',
      'chat.resize': 'Drag to resize the conversation panel',
      'chat.noSession': 'No conversation is selected',
      'agent.open': 'Ask DeepSeek',
      'agent.short': 'Agent',
      'agent.title': 'Work with DeepSeek',
      'agent.hint': 'Select code to explain, fix or test it. Without a selection the whole file is used.',
      'agent.selection': 'Lines {start}-{end} selected',
      'agent.fileOnly': 'Whole file',
      'agent.explain': 'Explain selection',
      'agent.fix': 'Fix selection',
      'agent.tests': 'Write tests for selection',
      'agent.file': 'Explain this file',
      'agent.send': 'Send to conversation',
      'agent.emptySelection': 'Select some code in the editor first',
      'agent.sent': 'Sent to the conversation',
      'agent.failed': 'Could not send: {message}',
      'agent.preview': 'Content to send',
      'chat.unavailable': 'Floating conversations are unavailable in this layout',
      'terminal.sessionMissing': 'Terminal session is closed',
      'panel.description': 'Browse the workspace tree, edit code, and preview Markdown and PDF files.',
      'guide.title': 'Code Workspace',
      'guide.description': 'Browse and edit files with highlighting, Markdown, and PDF previews.',
      'compact.back': 'Back to explorer',
      explorer: 'Explorer',
      'side.search': 'Search',
      'side.harness': 'Harness',
      'side.tabs': 'Sidebar views',
      'side.moveLeft': 'Move explorer to the left',
      'side.moveRight': 'Move explorer to the right',
      'search.placeholder': 'Search the workspace',
      'search.run': 'Search',
      'search.regex': 'Regex',
      'search.case': 'Case sensitive',
      'search.empty': 'Type a query to search',
      'search.noResults': 'No matches',
      'search.results': '{count} results',
      'search.truncated': 'Too many results; showing the first {count}',
      'search.busy': 'Searching…',
      'search.failed': 'Search failed: {message}',
      'search.sshUnsupported': 'Global search is not available for SSH workspaces',
      'search.clear': 'Clear search',
      'palette.files': 'Quick Open',
      'palette.commands': 'Command Palette',
      'palette.filesPlaceholder': 'Type a file name…',
      'palette.commandsPlaceholder': 'Type a command…',
      'palette.noFiles': 'No matching files',
      'palette.noCommands': 'No matching commands',
      'palette.loading': 'Loading files…',
      'palette.hint': '↑↓ select · Enter open · Esc close',
      'find.placeholder': 'Find in file',
      'find.replacePlaceholder': 'Replace with',
      'find.next': 'Next',
      'find.prev': 'Previous',
      'find.case': 'Case sensitive',
      'find.replace': 'Replace',
      'find.replaceAll': 'Replace all',
      'find.close': 'Close',
      'find.none': 'No matches',
      'harness.loading': 'Reading Harness information…',
      'harness.profile': 'Profile',
      'harness.version': 'Plugin version',
      'harness.bundles': 'Bundles',
      'harness.dependencies': 'Dependencies',
      'harness.config': 'Configuration',
      'harness.check': 'Run check',
      'harness.checking': 'Checking…',
      'harness.checkOk': 'Check passed',
      'harness.checkFailed': 'Check failed (exit {code})',
      'harness.output': 'Output',
      'harness.copy': 'Copy',
      'harness.closeConfig': 'Back',
      'harness.noConfig': 'No readable configuration files',
      'harness.failed': 'Read failed: {message}',
      favorites: 'Favorites',
      'favorite.add': 'Add to favorites',
      'favorite.remove': 'Remove from favorites',
      'favorite.addSelected': 'Add the selected item to favorites',
      'favorite.removeSelected': 'Remove the selected item from favorites',
      'favorite.empty': 'Right-click a file or folder and choose “Add to favorites”; click a favorite to jump to it.',
      'action.newFile': 'New file',
      'action.newFolder': 'New folder',
      'action.refresh': 'Refresh',
      'action.refreshRoots': 'Refresh workspaces',
      'action.collapseAll': 'Collapse all',
      'action.showHidden': 'Show hidden files',
      'action.hideHidden': 'Hide hidden files',
      'address.placeholder': 'Jump to a path: /data/project or src/lib',
      'action.go': 'Go',
      'action.save': 'Save',
      'action.reload': 'Reload',
      'action.overwrite': 'Overwrite',
      'action.open': 'Open',
      'action.openInBrowser': 'Open in browser',
      'action.maximize': 'Maximize editor',
      'action.restore': 'Restore layout',
      'action.rename': 'Rename',
      'action.delete': 'Delete',
      'action.copyPath': 'Copy relative path',
      'action.copyAbsolutePath': 'Copy absolute path',
      'action.copy': 'Copy',
      'action.cut': 'Cut',
      'action.paste': 'Paste',
      'action.pasteHere': 'Paste into this folder',
      'action.copyAll': 'Copy all',
      'action.upload': 'Upload files',
      'action.uploadHere': 'Upload files here',
      'action.uploading': 'Uploading…',
      'action.download': 'Download file',
      'action.downloadShort': 'Download',
      'action.copyShort': 'Copy',
      'action.jumpRoot': 'Go to the workspace root (Alt+Home)',
      'action.removeWorkspace': 'Remove workspace',
      'action.remove': 'Remove',
      'workspace.pickTitle': 'Switch or manage workspaces',
      'action.wrap': 'Word wrap',
      'action.wrapShort': 'Wrap',
      'action.nowrap': 'No wrap',
      'action.cancel': 'Cancel',
      'action.ok': 'OK',
      'action.discard': 'Discard changes',
      'action.preview': 'Preview',
      'action.edit': 'Edit',
      'action.split': 'Split',
      'action.splitExit': 'Exit split',
      'action.retry': 'Retry',
      'action.newFileHere': 'New file here',
      'action.newFolderHere': 'New folder here',
      'menu.refreshFolder': 'Refresh this folder',
      'workspace.label': 'Workspace',
      'ssh.add': 'Add SSH remote…',
      'ssh.title': 'Add SSH remote folder',
      'ssh.hint': 'Enter ssh://user@host:port/absolute/path. Authentication uses the SSH agent or keys under ~/.ssh; you can also enter a one-time password.',
      'ssh.password': 'Password (optional, this connection only)',
      'ssh.passwordHint': 'The password is used only to establish this connection and is never written to disk; re-enter it after the connection drops.',
      'ssh.enterPassword': 'Enter password',
      'ssh.badSpec': 'Invalid SSH address; use ssh://user@host:22/var/www',
      'ssh.notDirectory': 'That path is not a remote directory',
      'ssh.test': 'Test connection',
      'ssh.testing': 'Testing…',
      'ssh.connect': 'Connect and add',
      'ssh.checked': 'Connected: {name}',
      'ssh.connectFailed': 'SSH connection failed: {message}',
      'version.checkTitle': 'Check for plugin updates',
      'version.checking': 'Checking…',
      'version.latest': 'Up to date: v{version}',
      'version.updateTitle': 'Version v{latest} is available',
      'version.updateMessage': 'Current version v{current}; latest version v{latest}. For a local checkout, run git pull in the plugin repository and restart DSH. For a plugin-manager install, uninstall and reinstall it under Settings → Plugins. GitHub: https://github.com/taskkill/dsh-web-filebrowser',
      'version.openGithub': 'Open GitHub',
      'version.localUpdate': 'Local checkout: update repository',
      'version.pluginInstall': 'Plugin manager: install (uninstall first if present)',
      'version.updateNow': 'Update now',
      'version.updating': 'Updating…',
      'version.updateDone': 'Update complete',
      'version.updateNoChange': 'Already up to date',
      'version.updateRestart': 'The update was applied. Restart DSH to load the Host code, then refresh the page. If dependencies changed, run npm install before restarting.',
      'version.updateNoChangeMessage': 'The repository has no new commits.',
      'version.updateFailed': 'Update failed',
      'version.updateOutput': 'Update output',
      'version.checkFailed': 'Update check failed: {message}',
      welcomeTitle: 'Workspace Files',
      welcomeHint: 'Browse directories in the Explorer. Click a file to open it, click a folder to select it, and double-click a folder to expand or collapse it.',
      welcomeShortcuts: '⌘/Ctrl + S save · F2 rename · Delete remove',
      welcomeNewFile: 'Create your first file',
      'hint.loading': 'Loading…',
      'hint.empty': 'Empty directory',
      'hint.hiddenOnly': 'Hidden files only; use the eye button to show them.',
      'hint.noRoot': 'No workspace directory is available.',
      'hint.noRootAction': 'Open or create a workspace in Harness, then retry.',
      'hint.noFile': 'Select a file on the left to start editing.',
      'hint.binary': 'This is a binary file; the editor cannot open it as text.',
      'hint.tooLarge': 'This file is too large for the editor.',
      'hint.pdf': 'PDF preview',
      'hint.image': 'Image preview',
      'hint.dirtyClose': 'This file has unsaved changes.',
      'hint.unsaved': 'Unsaved',
      'hint.saved': 'Saved',
      'hint.loadingFile': 'Loading file…',
      'hint.preview': 'Markdown preview',
      'hint.other': 'Other',
      'status.encoding': 'UTF-8',
      'browser.open': 'Built-in browser',
      'browser.newTab': 'New browser tab',
      'browser.back': 'Back',
      'browser.forward': 'Forward',
      'browser.reload': 'Reload',
      'browser.address': 'Address',
      'browser.placeholder': 'Enter localhost:5173 or https://…',
      'browser.host': 'Host',
      'browser.scheme': 'Protocol',
      'browser.schemeAuto': 'Auto',
      'browser.hostHint': 'Port shortcuts use this protocol and host',
      'browser.hostReset': 'Reset to localhost',
      'browser.resetDefaults': 'Reset',
      'browser.openExternal': 'Open in external browser',
      'browser.badUrl': 'Only http/https addresses are supported',
      'browser.startTitle': 'Preview a running page',
      'browser.startHint': 'Enter a dev-server address and press Enter, or pick a detected local port below.',
      'browser.detected': 'Detected local ports',
      'browser.rescan': 'Rescan',
      'browser.viewport': 'Preview viewport',
      'browser.pc': 'PC',
      'browser.mobile': 'Mobile',
      'browser.direct': 'Direct',
      'browser.proxy': 'Proxy',
      'browser.proxyHint': 'Switch to Proxy when direct embedding is refused; the proxy carries no cookies/login state and may render SPAs incompletely',
      'browser.pcHint': 'Preview at the current panel width',
      'browser.mobileHint': 'Fixed mobile viewport; viewport only, without touch or User-Agent emulation',
      'browser.device': 'Device size',
      'browser.rotate': 'Rotate viewport',
      'browser.scanning': 'Scanning ports…',
      'browser.noPorts': 'No listening local ports detected; enter an address above.',
      'browser.scanUnsupported': 'Port scanning is not available on this platform; enter an address above.',
      'browser.common': 'Common ports',
      'browser.startFooter': 'Local dev servers and public pages load directly by default. If a public page is blank or refused, switch to Proxy in the toolbar. The proxy carries no cookies/login state, so SPAs may be incomplete; use the external browser when needed.',
      'browser.sameOrigin': 'The Harness page cannot be embedded',
      'browser.sameOriginHint': 'This address has the same origin as the Harness UI, so embedding it would allow clickjacking. Open it in an external browser instead.',
      'browser.mixed': 'This Harness page is HTTPS; an HTTP preview may be blocked by the browser. Use the external browser if it stays blank.',
      'status.lines': '{count} lines',
      'status.cursor': 'Ln {line}, Col {column}',
      'error.roots': 'Could not read the workspace list: {message}',
      'error.list': 'Could not read the directory: {message}',
      'error.pathNotFound': 'Path not found: {path}',
      'error.notDirectoryPath': '{path} is not a directory',
      'error.openRootFailed': 'Could not open the directory: {message}',
      'error.removeWorkspaceFailed': 'Could not remove the workspace: {message}',
      'error.workspaceRecord': 'Could not find this workspace record; refresh the workspace list and retry.',
      'error.uploadFailed': 'Could not upload “{name}”: {message}',
      'error.transferFailed': 'Operation failed: {message}',
      'error.intoItself': 'A folder cannot be moved inside itself',
      'error.fileTooLarge': '“{name}” exceeds the {size} upload limit.',
      'error.needRoot': 'Choose or enter a workspace directory first.',
      'error.read': 'Could not read the file: {message}',
      'error.saveFailed': 'Save failed: {message}',
      'error.createFailed': 'Create failed: {message}',
      'error.renameFailed': 'Rename failed: {message}',
      'error.deleteFailed': 'Delete failed: {message}',
      'error.badName': 'A name cannot contain “/” or “\\”, and cannot be “.” or “..”.',
      'error.nameTaken': 'A file or folder with that name already exists.',
      'error.notFound': 'The file or folder no longer exists.',
      'error.outsideRoot': 'Only paths inside the workspace can be accessed.',
      'error.stale': 'The file changed on disk, so the save was blocked.',
      'error.tooLarge': 'The file exceeds the editor size limit.',
      'error.binary': 'This is a binary file and cannot be edited as text.',
      'error.exists': 'A file or folder with that name already exists.',
      'error.internal': 'Request failed: {message}',
      'modal.deleteTitle': 'Delete',
      'modal.deleteFile': 'Delete the file “{name}”? This cannot be undone.',
      'modal.deleteFolder': 'Delete the folder “{name}” and all of its contents? This cannot be undone.',
      'modal.dirtyTitle': 'Unsaved changes',
      'modal.dirtyMessage': '“{name}” has unsaved changes. Closing it discards them.',
      'modal.switchRootTitle': 'Switch workspace',
      'modal.switchRootMessage': 'Some files have unsaved changes. Switching workspaces closes them and discards those changes.',
      'modal.deleteWorkspaceTitle': 'Remove workspace',
      'modal.deleteWorkspaceMessage': 'Remove “{name}” ({path}) from the workspace list? Files on disk are not deleted; sessions stay, but they are no longer grouped under this workspace.',
      'modal.deleteWorkspaceDirty': 'This workspace has unsaved files. Removing “{name}” ({path}) closes them and discards those changes; files on disk and sessions stay.',
      'modal.hideRootTitle': 'Remove directory from the list',
      'modal.hideRootMessage': 'Hide “{name}” ({path}) from this plugin’s directory list? Files on disk are not deleted; you can reopen it from the address bar later.',
      'modal.confirmDelete': 'Delete',
      'toast.saved': 'Saved',
      'toast.refreshed': 'Refreshed',
      'toast.copied': 'Path copied',
      'toast.copyFailed': 'Could not copy the path',
      'toast.copiedAll': 'Copied the whole file',
      'toast.rootSwitched': 'Workspace switched',
      'toast.workspaceRemoved': 'Workspace removed',
      'toast.uploading': 'Uploading {count} file(s)…',
      'toast.uploaded': 'Uploaded {count} file(s)',
      'toast.itemCopied': 'Copied “{name}”',
      'toast.itemCut': 'Cut “{name}”',
      'toast.itemMoved': 'Moved “{name}”',
      'title.newFile': 'New file',
      'title.newFolder': 'New folder',
      'title.rename': 'Rename',
      'title.readError': 'Could not open the file',
      'title.preview': 'Preview',
      'title.edit': 'Edit',
      'panel.tooltip': 'Open Workspace Files',
      'root.none': 'No workspace',
      'markdown.empty': 'This Markdown file is empty.',
      'pdf.open': 'Open PDF in a new tab',
      'image.open': 'Open image in a new tab',
      'file.openExternal': 'Open with the browser',
      'git.title': 'Git',
      'git.toggle': 'Git source control',
      'git.backToFiles': 'Back to files',
      'git.loading': 'Reading Git status…',
      'git.refresh': 'Refresh Git status',
      'git.noRoot': 'Select a workspace first',
      'git.notRepo': 'This workspace is not a Git repository',
      'git.notRoot': 'This directory is not the repository root. Open the repository root to use Git.',
      'git.init': 'Initialize repository',
      'git.initHint': 'Initialize it to stage, commit and switch branches.',
      'git.branch': 'Branch',
      'git.switchBranch': 'Switch branch',
      'git.noBranches': 'No local branches',
      'git.current': 'Current',
      'git.detached': 'HEAD detached',
      'git.unborn': 'No commits yet',
      'git.ahead': '{n} ahead',
      'git.behind': '{n} behind',
      'git.gone': 'Upstream is gone',
      'git.staged': 'Staged changes',
      'git.changes': 'Changes',
      'git.history': 'Commit graph',
      'git.commitGraph': 'Commit graph',
      'git.loadingHistory': 'Loading commit history…',
      'git.loadingCommit': 'Loading commit…',
      'git.noCommits': 'No commits yet',
      'git.commitNoFiles': 'This commit changed no files',
      'git.mergeCommit': 'Merge commit ({n} parents)',
      'git.graphTruncated': 'Showing the latest 200 rows',
      'git.retry': 'Retry',
      'git.clean': 'Working tree clean',
      'git.stage': 'Stage',
      'git.unstage': 'Unstage',
      'git.stageAll': 'Stage all',
      'git.unstageAll': 'Unstage all',
      'git.discard': 'Restore',
      'git.discardTitle': 'Restore changes',
      'git.discardConfirm': 'Restore “{path}” to the index? Unsaved content will be lost.',
      'git.discardStagedConfirm': 'Restore “{path}” to HEAD and unstage it? Staged and working-tree changes will be lost.',
      'git.discardUntrackedConfirm': 'Delete untracked file “{path}”? The file will be removed from disk.',
      'git.discardConflictConfirm': 'Restore conflicted file “{path}” to HEAD? The current conflict resolution will be lost.',
      'git.discardUntrackedHint': 'Delete untracked file',
      'git.discardConflictHint': 'Restore the conflicted file to HEAD',
      'git.discardAll': 'Restore all',
      'git.discardAllConfirm': 'Restore all {n} changes? Untracked files will be deleted and cannot be recovered.',
      'git.discardOk': 'Changes restored',
      'git.commit': 'Commit',
      'git.committing': 'Committing…',
      'git.commitPlaceholder': 'Commit message (Ctrl/⌘+Enter to commit)',
      'git.commitEmpty': 'Enter a commit message',
      'git.noStaged': 'No staged changes',
      'git.commitOk': 'Committed',
      'git.checkoutOk': 'Branch switched',
      'git.initOk': 'Git repository initialized',
      'git.diffStaged': 'Staged',
      'git.diffMode': 'Diff view',
      'git.diffSplit': 'Split',
      'git.diffSplitHint': 'View changes side by side',
      'git.diffUnified': 'Unified',
      'git.diffUnifiedHint': 'View as a unified diff',
      'git.diffOldSide': 'Original',
      'git.diffNewSide': 'Modified',
      'git.diffTruncated': 'Diff is large; showing the first {n} rows. Switch to Unified for the full diff.',
      'git.diffSplitUnavailable': 'This diff cannot be shown side by side; using the unified view.',
      'git.diffReadOnly': 'Read-only',
      'git.loadingDiff': 'Loading diff…',
      'git.refreshDiff': 'Refresh diff',
      'git.diffWorking': 'Working tree',
      'git.untracked': 'Untracked',
      'git.conflict': 'Conflict',
      'git.noDiff': 'No diff to show',
      'git.openFile': 'Open file',
      'git.close': 'Close',
      'git.retry': 'Retry',
      'git.installHint': 'Git support is not installed. Install @local/dsh-web-filebrowser-git.',
      'git.error': 'Git operation failed',
      'git.busy': 'Working…',
      'git.fetch': 'Fetch',
      'git.fetching': 'Fetching…',
      'git.fetchHint': 'Fetch remote refs without touching the working tree',
      'git.fetchOk': 'Fetched remote updates',
      'git.fetchNone': 'Already up to date; no new remote refs',
      'git.pull': 'Pull',
      'git.pulling': 'Pulling…',
      'git.pullHint': 'Fast-forward from the upstream branch',
      'git.pullOk': 'Pulled remote updates',
      'git.push': 'Push',
      'git.pushing': 'Pushing…',
      'git.pushHint': 'Push the current branch to its upstream',
      'git.pushOk': 'Pushed',
      'git.pushSetUpstream': 'Pushed and set upstream to {upstream}',
      'git.commitAndPush': 'Commit & push',
      'git.commitPushOk': 'Committed and pushed',
      'git.compare': 'Compare',
      'git.compareHint': 'Compare commits and files with upstream or another branch',
      'git.compareTitle': 'Compare branches',
      'git.compareBase': 'Base',
      'git.compareLoading': 'Comparing…',
      'git.compareOurs': 'Only on this branch',
      'git.compareTheirs': 'Only on base',
      'git.compareFiles': 'Changed files',
      'git.compareNoDiff': 'No differences',
      'git.compareFailed': 'Comparison failed',
      'git.stash': 'Stash',
      'git.stashHint': 'Stash current changes, or apply, pop and drop existing stashes',
      'git.stashTitle': 'Stashes',
      'git.stashSave': 'Stash current changes',
      'git.stashSaveHint': 'Save working-tree and staged changes as a new stash.',
      'git.stashSaving': 'Stashing…',
      'git.stashMessagePlaceholder': 'Stash message (optional)',
      'git.stashIncludeUntracked': 'Include untracked files',
      'git.stashNoChanges': 'No changes to stash',
      'git.stashOk': 'Changes stashed',
      'git.stashEmpty': 'No stashes yet',
      'git.stashLoading': 'Loading stashes…',
      'git.stashApply': 'Apply',
      'git.stashApplyHint': 'Apply the stash to the working tree and keep it',
      'git.stashApplyOk': 'Stash applied',
      'git.stashPop': 'Pop',
      'git.stashPopHint': 'Apply the stash and remove it from the list',
      'git.stashPopOk': 'Stash popped',
      'git.stashDrop': 'Drop stash',
      'git.stashDropTitle': 'Drop stash',
      'git.stashDropConfirm': 'Drop {ref}? The stash cannot be recovered.',
      'git.stashDropOk': 'Stash dropped',
      'git.stashConflict': 'The stash conflicts with the working tree or its index could not be restored; some changes may already be applied. Check the conflict in a terminal. The stash entry is kept.',
      'git.noStash': 'The stash entry does not exist or was already removed.',
      'git.unmerged': 'Unresolved conflicts prevent stashing; resolve them in a terminal first.',
      'git.authRequired': 'The remote requires authentication. Configure an SSH key or a Git credential helper on the Host; this plugin never stores credentials.',
      'git.noRemote': 'This repository has no configured remote.',
      'git.noUpstream': 'The current branch has no upstream, so it cannot be pulled.',
      'git.nonFastForward': 'The remote has new commits and rejected the push. Pull or merge first.',
      'git.diverged': 'The local branch has diverged from its upstream; rebase or merge it in a terminal first.',
      'git.detachedPush': 'HEAD is detached, so there is nothing to push.',
      'git.noCommits': 'There are no commits yet.',
      'git.networkError': 'Could not reach the remote. Check the network or the remote URL.',
      'git.conflictError': 'The operation produced conflicts; resolve them in a terminal first.',
      'git.dirtyError': 'The working tree has uncommitted changes; commit or stash them before pulling.',
      'git.rejected': 'The remote rejected this push.',
    }

    /* ------------------------------------------------------------------ *
     * Utilities
     * ------------------------------------------------------------------ */

    /** Whether this page is running in a mobile/tablet browser, not merely a narrow desktop window. */
    function detectMobileBrowser() {
      if (typeof navigator === 'undefined') return false
      if (navigator.userAgentData?.mobile === true) return true
      const ua = typeof navigator.userAgent === 'string' ? navigator.userAgent : ''
      if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone|HarmonyOS|MicroMessenger/iu.test(ua)) return true
      // iPadOS reports a desktop Macintosh UA unless it is in a very old mode.
      if (/Macintosh/iu.test(ua) && Number(navigator.maxTouchPoints) > 1) return true
      return false
    }

    function clsx(...values) {
      return values.filter(Boolean).join(' ')
    }

    function basename(value) {
      const index = value.lastIndexOf('/')
      return index < 0 ? value : value.slice(index + 1)
    }

    function dirname(value) {
      const index = value.lastIndexOf('/')
      return index < 0 ? '' : value.slice(0, index)
    }

    function joinPath(parent, name) {
      return parent.length === 0 ? name : `${parent}/${name}`
    }

    /** Join a workspace root with a repo-relative path using the host's separator. */
    function absolutePathOf(root, relative) {
      if (relative.length === 0) return root
      const separator = root.includes('/') || !root.includes('\\') ? '/' : '\\'
      const base = root.replace(/[\\/]+$/u, '')
      const tail = separator === '\\' ? relative.replaceAll('/', '\\') : relative
      return base.length === 0 ? `${separator}${tail}` : `${base}${separator}${tail}`
    }

    function extensionOf(name) {
      const base = basename(name)
      const index = base.lastIndexOf('.')
      return index <= 0 ? '' : base.slice(index + 1).toLowerCase()
    }

    function isAbsolutePath(value) {
      return typeof value === 'string' && value.length > 0 && (value.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(value))
    }

    function isValidName(name) {
      return name.length > 0 && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\') && !name.includes('\u0000')
    }

    class SideRequestError extends Error {
      constructor(code, message, details) {
        super(message)
        this.name = 'SideRequestError'
        this.code = code
        this.details = details
      }
    }

    function errorCode(error) {
      return error instanceof SideRequestError ? error.code : 'internal'
    }

    function errorText(error) {
      return error instanceof Error ? error.message : String(error)
    }

    function apiUrl() {
      return new URL(API_PATH, document.baseURI).href
    }

    function proxyUrl(target) {
      const url = new URL(PROXY_PATH, document.baseURI)
      url.searchParams.set('url', target)
      return url.href
    }

    function isDirectPreviewUrl(target) {
      try {
        const host = new URL(target).hostname.toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '')
        if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
        if (host === '::1') return true
        const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host)
        if (ipv4 !== null) {
          const first = Number(ipv4[1])
          const second = Number(ipv4[2])
          return first === 10 || first === 127 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31) || (first === 169 && second === 254)
        }
        return false
      } catch {
        return false
      }
    }

    function rawUrl(root, relative) {
      const url = new URL(apiUrl())
      url.searchParams.set('op', 'raw')
      url.searchParams.set('root', root)
      url.searchParams.set('path', relative)
      return url.href
    }

    function ioUrl(op, params) {
      const url = new URL(IO_PATH, document.baseURI)
      url.searchParams.set('op', op)
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
      }
      return url
    }

    function ioDownloadUrl(root, relative) {
      return ioUrl('download', { root, path: relative }).href
    }

    function sshUploadUrl(root, relative) {
      const url = new URL(SSH_UPLOAD_PATH, document.baseURI)
      url.searchParams.set('root', root)
      url.searchParams.set('path', relative)
      return url
    }

    async function uploadToWorkspace(root, relative, file) {
      const url = isSshRootPath(root) ? sshUploadUrl(root, relative) : ioUrl('upload', { root, path: relative })
      let response
      try {
        response = await fetch(url.href, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file,
        })
      } catch (error) {
        throw new SideRequestError('offline', `无法连接 Harness：${errorText(error)}`)
      }
      if (!response.ok) {
        throw new SideRequestError(`http-${String(response.status)}`, `HTTP ${String(response.status)} ${response.statusText}`)
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new SideRequestError('bad-response', '服务返回了无法解析的响应')
      }
      if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
        const failure = payload?.error ?? {}
        throw new SideRequestError(failure.code ?? 'unknown', failure.message ?? '上传失败')
      }
      return payload.value
    }

    async function call(op, params = {}) {
      let response
      try {
        response = await fetch(apiUrl(), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op, ...params }),
        })
      } catch (error) {
        throw new SideRequestError('offline', `无法连接 Harness：${errorText(error)}`)
      }
      if (!response.ok) {
        throw new SideRequestError(`http-${String(response.status)}`, `HTTP ${String(response.status)} ${response.statusText}`)
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new SideRequestError('bad-response', '服务返回了无法解析的响应')
      }
      if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
        const failure = payload?.error ?? {}
        throw new SideRequestError(failure.code ?? 'unknown', failure.message ?? '请求失败', failure.details)
      }
      return payload.value
    }

    function gitApiUrl() {
      return new URL(GIT_PATH, document.baseURI).href
    }

    async function callGit(op, params = {}) {
      let response
      try {
        response = await fetch(gitApiUrl(), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op, ...params }),
        })
      } catch (error) {
        throw new SideRequestError('git-offline', `无法连接 Git 服务：${errorText(error)}`)
      }
      if (response.status === 404) {
        throw new SideRequestError('git-bridge-missing', 'Git 支持未安装：请安装 @local/dsh-web-filebrowser-git')
      }
      if (!response.ok) {
        throw new SideRequestError(`http-${String(response.status)}`, `HTTP ${String(response.status)} ${response.statusText}`)
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new SideRequestError('bad-response', 'Git 服务返回了无法解析的响应')
      }
      if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
        const failure = payload?.error ?? {}
        throw new SideRequestError(failure.code ?? 'git-error', failure.message ?? 'Git 操作失败')
      }
      return payload.value
    }

    /* ------------------------------------------------------------------ *
     * File kinds and languages
     * ------------------------------------------------------------------ */

    const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd', 'mdx'])
    const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg'])
    const BINARY_EXTENSIONS = new Set([
      'zip', 'gz', 'tgz', 'tar', 'rar', '7z', 'bz2', 'xz', 'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'jar',
      'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'm4a', 'mov', 'avi', 'mkv', 'webm', 'wav', 'flac',
      'psd', 'ai', 'sketch', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'wasm', 'db',
    ])

    function modeOf(name) {
      const ext = extensionOf(name)
      if (ext === 'pdf') return 'pdf'
      if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown'
      if (IMAGE_EXTENSIONS.has(ext)) return 'image'
      if (BINARY_EXTENSIONS.has(ext)) return 'binary'
      return 'text'
    }

    /** Modes whose content is UTF-8 text held in a tab (code/plain and Markdown). */
    function isTextMode(mode) {
      return mode === 'text' || mode === 'markdown'
    }

    const LANGUAGE_ROWS = [
      [['kt', 'kts'], 'kotlin', 'Kotlin'],
      [['scala', 'sc'], 'scala', 'Scala'],
      [['swift'], 'swift', 'Swift'],
      [['dart'], 'dart', 'Dart'],
      [['groovy', 'gradle'], 'groovy', 'Groovy'],
      [['r'], 'r', 'R'],
      [['pl', 'pm'], 'perl', 'Perl'],
      [['ps1', 'psm1'], 'powershell', 'PowerShell'],
      [['fs', 'fsx', 'fsi'], 'fsharp', 'F#'],
      [['vb', 'vbs'], 'vb', 'VB.NET'],
      [['m'], 'objectivec', 'Objective-C'],
      [['proto'], 'proto', 'Protocol Buffers'],
      [['graphql', 'gql'], 'graphql', 'GraphQL'],
      [['tf', 'tfvars', 'hcl'], 'terraform', 'Terraform'],
      [['cmake'], 'cmake', 'CMake'],
      [['dockerfile'], 'dockerfile', 'Dockerfile'],
      [['mk'], 'makefile', 'Makefile'],
      [['js', 'mjs', 'cjs', 'jsx'], 'javascript', 'JavaScript'],
      [['ts', 'tsx', 'mts', 'cts'], 'typescript', 'TypeScript'],
      [['json', 'jsonc', 'json5'], 'json', 'JSON'],
      [['css', 'scss', 'less'], 'css', 'CSS'],
      [['cshtml', 'razor'], 'razor', 'Razor'],
      [['html', 'htm', 'xhtml', 'vue', 'svelte'], 'html', 'HTML'],
      [['xml', 'svg', 'plist', 'xaml', 'csproj', 'props', 'targets', 'fsproj', 'vbproj'], 'html', 'XML'],
      [['py', 'pyw'], 'python', 'Python'],
      [['sh', 'bash', 'zsh', 'fish'], 'shell', 'Shell'],
      [['yml', 'yaml'], 'yaml', 'YAML'],
      [['sql'], 'sql', 'SQL'],
      [['md', 'markdown', 'mdown', 'mkd', 'mdx'], 'markdown', 'Markdown'],
      [['rs'], 'rust', 'Rust'],
      [['go'], 'go', 'Go'],
      [['java'], 'java', 'Java'],
      [['c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'mm'], 'cpp', 'C/C++'],
      [['cs', 'csx'], 'csharp', 'C#'],
      [['rb'], 'ruby', 'Ruby'],
      [['php'], 'php', 'PHP'],
      [['lua'], 'lua', 'Lua'],
      [['toml', 'ini', 'conf', 'cfg', 'env'], 'config', 'Config'],
      [['lock'], 'config', 'Lockfile'],
      [['diff', 'patch'], 'diff', 'Diff'],
    ]

    function languageOf(name) {
      const ext = extensionOf(name)
      const base = basename(name).toLowerCase()
      if (base === 'dockerfile' || base.startsWith('dockerfile.') || base === 'containerfile' || base.startsWith('containerfile.')) {
        return { id: 'dockerfile', label: 'Dockerfile' }
      }
      if (base === 'makefile' || base.startsWith('makefile.') || base === 'gnumakefile') {
        return { id: 'makefile', label: 'Makefile' }
      }
      if (base === 'cmakelists.txt') return { id: 'cmake', label: 'CMake' }
      for (const [extensions, id, label] of LANGUAGE_ROWS) {
        if (extensions.includes(ext)) return { id, label }
      }
      return { id: 'plain', label: 'Text' }
    }

    /* ------------------------------------------------------------------ *
     * Syntax highlighting
     * ------------------------------------------------------------------ */

    const JS_KEYWORDS = new Set([
      'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
      'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
      'import', 'in', 'instanceof', 'interface', 'let', 'new', 'of', 'package', 'private', 'protected', 'public',
      'readonly', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof', 'var',
      'void', 'while', 'with', 'yield', 'enum', 'declare', 'namespace', 'keyof', 'satisfies', 'infer', 'abstract',
    ])
    const TS_KEYWORDS = new Set([
      ...JS_KEYWORDS,
      'override', 'accessor', 'using', 'any', 'unknown', 'never', 'number', 'string', 'boolean', 'bigint', 'symbol',
      'object', 'global', 'module',
    ])
    const PY_KEYWORDS = new Set([
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
      'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
      'raise', 'return', 'try', 'while', 'with', 'yield', 'match', 'case',
    ])
    const SH_KEYWORDS = new Set([
      'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function', 'in',
      'local', 'export', 'readonly', 'return', 'exit', 'echo', 'printf', 'cd', 'pwd', 'mkdir', 'rm', 'mv', 'cp',
      'cat', 'grep', 'sed', 'awk', 'curl', 'wget', 'git', 'npm', 'pnpm', 'node', 'python', 'sudo',
    ])
    const SQL_KEYWORDS = new Set([
      'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'drop',
      'alter', 'add', 'column', 'index', 'join', 'inner', 'left', 'right', 'outer', 'full', 'on', 'group', 'by',
      'order', 'having', 'limit', 'offset', 'union', 'all', 'distinct', 'as', 'and', 'or', 'not', 'null', 'is',
      'in', 'between', 'like', 'exists', 'case', 'when', 'then', 'else', 'end', 'primary', 'key', 'foreign',
      'references', 'default', 'constraint', 'unique', 'begin', 'commit', 'rollback', 'with', 'asc', 'desc',
    ])
    const C_KEYWORDS = new Set([
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern',
      'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return', 'short', 'signed',
      'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', 'class',
      'namespace', 'template', 'typename', 'public', 'private', 'protected', 'virtual', 'override', 'using',
      'nullptr', 'true', 'false', 'new', 'delete', 'try', 'catch', 'throw', 'auto', 'alignas', 'alignof',
      'and', 'and_eq', 'asm', 'bitand', 'bitor', 'bool', 'char8_t', 'char16_t', 'char32_t', 'compl', 'concept',
      'consteval', 'constexpr', 'constinit', 'const_cast', 'co_await', 'co_return', 'co_yield', 'decltype',
      'dynamic_cast', 'explicit', 'export', 'final', 'friend', 'mutable', 'noexcept', 'not', 'not_eq', 'operator',
      'or', 'or_eq', 'reinterpret_cast', 'requires', 'static_assert', 'static_cast', 'thread_local', 'typeid',
      'wchar_t', 'xor', 'xor_eq', 'module', 'import',
    ])
    const CSHARP_KEYWORDS = new Set([
      'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked', 'class', 'const',
      'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern',
      'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface',
      'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
      'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
      'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
      'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
      'async', 'await', 'var', 'dynamic', 'yield', 'when', 'where', 'get', 'set', 'init', 'record', 'required',
      'file', 'global', 'partial', 'nameof', 'with', 'not', 'and', 'or', 'add', 'remove',
    ])
    const GO_KEYWORDS = new Set([
      'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for', 'func', 'go',
      'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
      'var',
    ])
    const RUST_KEYWORDS = new Set([
      'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn',
      'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'static',
      'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
    ])
    const JAVA_KEYWORDS = new Set([
      'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
      'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
      'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
      'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
      'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'record', 'sealed', 'permits',
      'var', 'yield', 'module', 'requires', 'exports', 'opens', 'provides', 'uses', 'to', 'with', 'transitive',
    ])
    const RUBY_KEYWORDS = new Set([
      'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined', 'do', 'else', 'elsif', 'end', 'ensure',
      'false', 'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self',
      'super', 'then', 'true', 'undef', 'unless', 'until', 'when', 'while', 'yield',
    ])
    const PHP_KEYWORDS = new Set([
      'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone', 'const', 'continue',
      'declare', 'default', 'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach', 'endif',
      'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'final', 'finally', 'fn', 'for', 'foreach', 'function',
      'global', 'goto', 'if', 'implements', 'include', 'include_once', 'instanceof', 'insteadof', 'interface',
      'isset', 'list', 'match', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public', 'readonly',
      'require', 'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use', 'var',
      'while', 'xor', 'yield', 'true', 'false', 'null',
    ])
    const LUA_KEYWORDS = new Set([
      'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'goto', 'if', 'in', 'local', 'nil',
      'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while',
    ])

    function keywordClassifier(words) {
      return (text, code, index) => {
        if (text.startsWith('//') || text.startsWith('/*') || text.startsWith('#') || text.startsWith('--')) return 'comment'
        if (text.startsWith('"') || text.startsWith("'") || text.startsWith('`')) return 'string'
        if (/^[0-9]/u.test(text)) return 'number'
        if (words.has(text.toLowerCase()) || words.has(text)) return 'keyword'
        if (/^(?:true|false|null|undefined|nil|none|NaN|Infinity)$/u.test(text)) return 'constant'
        const after = code.slice(index + text.length)
        if (/^\s*\(/u.test(after)) return 'function'
        if (/^[A-Z]/u.test(text)) return 'type'
        return 'plain'
      }
    }

    function jsonClassifier(text, code, index) {
      if (text.startsWith('"')) {
        const rest = code.slice(index + text.length)
        return /^\s*:/u.test(rest) ? 'property' : 'string'
      }
      if (/^-?[0-9]/u.test(text)) return 'number'
      return 'constant'
    }

    function cssClassifier(text, code, index) {
      if (text.startsWith('/*')) return 'comment'
      if (text.startsWith('"') || text.startsWith("'")) return 'string'
      if (text.startsWith('@')) return 'keyword'
      if (/^#[0-9a-f]{3,8}$/iu.test(text)) return 'number'
      if (/^[0-9]/u.test(text)) return 'number'
      const after = code.slice(index + text.length)
      if (/^\s*:/u.test(after)) return 'property'
      return 'plain'
    }

    function htmlClassifier(text, code, index) {
      if (text.startsWith('<!--')) return 'comment'
      if (text.startsWith('<')) return 'tag'
      if (text.startsWith('"') || text.startsWith("'")) return 'string'
      const after = code.slice(index + text.length)
      if (/^\s*=/u.test(after)) return 'attr'
      return 'plain'
    }

    function yamlClassifier(text, code, index) {
      if (text.startsWith('#')) return 'comment'
      if (text.startsWith('"') || text.startsWith("'")) return 'string'
      if (/^(?:true|false|null|yes|no)$/iu.test(text)) return 'constant'
      if (/^-?[0-9]/u.test(text)) return 'number'
      const after = code.slice(index + text.length)
      if (/^\s*:/u.test(after)) return 'property'
      return 'plain'
    }

    function markdownClassifier(text) {
      if (/^#{1,6}/u.test(text)) return 'heading'
      if (text.startsWith('```') || text.startsWith('~~~')) return 'comment'
      if (text.startsWith('`')) return 'string'
      if (/^\[[^\]]*\]\(/u.test(text) || /^!\[[^\]]*\]\(/u.test(text)) return 'link'
      if (/^\*\*|^__|^\*[^*]|^_[^_]/u.test(text)) return 'keyword'
      if (/^\s*(?:[-*+]|\d+\.)\s/u.test(text)) return 'property'
      if (/^>/u.test(text)) return 'comment'
      return 'plain'
    }

    const HIGHLIGHTERS = {
      javascript: {
        re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|[^\\`])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b\d(?:[\w.]*)\b|[A-Za-z_$][\w$]*/gu,
        classify: keywordClassifier(JS_KEYWORDS),
      },
      typescript: {
        re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|[^\\`])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b\d(?:[\w.]*)\b|[A-Za-z_$][\w$]*/gu,
        classify: keywordClassifier(TS_KEYWORDS),
      },
      json: {
        re: /"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b/gu,
        classify: jsonClassifier,
      },
      css: {
        re: /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[0-9a-fA-F]{3,8}\b|@[\w-]+|--?[\w-]+(?=\s*:)|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch|ex)?\b/gu,
        classify: cssClassifier,
      },
      html: {
        re: /<!--[\s\S]*?-->|<\/?[A-Za-z][\w:-]*|[A-Za-z_:][\w:.-]*(?==)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gu,
        classify: htmlClassifier,
      },
      python: {
        re: /#[^\n]*|'''[\s\S]*?'''|"""[\s\S]*?"""|[rbfu]{0,2}"(?:\\.|[^"\\\n])*"|[rbfu]{0,2}'(?:\\.|[^'\\\n])*'|@[\w.]+\b|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*/gu,
        classify: keywordClassifier(PY_KEYWORDS),
      },
      shell: {
        re: /#[^\n]*|"(?:\\.|[^"\\])*"|'[^']*'|\$\{?[\w@#?*!-]+\}?|\b\d+\b|[A-Za-z_][\w-]*/gu,
        classify: (text, code, index) => {
          if (text.startsWith('#')) return 'comment'
          if (text.startsWith('"') || text.startsWith("'")) return 'string'
          if (text.startsWith('$')) return 'property'
          if (/^[0-9]/u.test(text)) return 'number'
          if (SH_KEYWORDS.has(text)) return 'keyword'
          const after = code.slice(index + text.length)
          if (/^\s*\(\)/u.test(after)) return 'function'
          return 'plain'
        },
      },
      yaml: {
        re: /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|^[ \t-]*[A-Za-z_][\w.-]*(?=\s*:)|\b-?\d+(?:\.\d+)?\b|\b(?:true|false|null|yes|no)\b/gmu,
        classify: yamlClassifier,
      },
      sql: {
        re: /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*/gu,
        classify: (text, code, index) => keywordClassifier(SQL_KEYWORDS)(text, code, index),
      },
      markdown: {
        re: /^#{1,6}[^\n]*|^```[\s\S]*?^```|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|!?\[[^\]\n]*\]\([^)\n]*\)|^[ \t]*(?:[-*+]|\d+\.)[ \t]|^>[^\n]*/gmu,
        classify: markdownClassifier,
      },
      rust: {
        re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b\d(?:[\w.]*)\b|[A-Za-z_]\w*!?/gu,
        classify: keywordClassifier(RUST_KEYWORDS),
      },
      go: {
        re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`[^`]*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b\d(?:[\w.]*)\b|[A-Za-z_]\w*/gu,
        classify: keywordClassifier(GO_KEYWORDS),
      },
      java: {
        re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b\d(?:[\w.]*)\b|[A-Za-z_$][\w$]*/gu,
        classify: keywordClassifier(JAVA_KEYWORDS),
      },
      cpp: {
        re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#\s*\w+|\b\d(?:[\w.]*)\b|[A-Za-z_]\w*/gu,
        classify: (text, code, index) => {
          if (text.startsWith('#')) return 'keyword'
          return keywordClassifier(C_KEYWORDS)(text, code, index)
        },
      },
      csharp: {
        re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|\$?@"(?:""|[^"])*"|\$?"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#\s*[A-Za-z]+|\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:[fFdDmMuUlL]+)?\b|@[A-Za-z_]\w*|[A-Za-z_]\w*/gu,
        classify: (text, code, index) => {
          if (text.startsWith('//') || text.startsWith('/*')) return 'comment'
          if (text.startsWith('"') || text.startsWith("'") || text.startsWith('$')) return 'string'
          if (text.startsWith('@"') || text.startsWith('$@"')) return 'string'
          if (text.startsWith('@')) return 'plain'
          if (text.startsWith('#')) return 'keyword'
          if (/^[0-9]/.test(text)) return 'number'
          if (CSHARP_KEYWORDS.has(text)) return 'keyword'
          if (/^(?:true|false|null)$/.test(text)) return 'constant'
          const after = code.slice(index + text.length)
          if (/^\s*\(/.test(after)) return 'function'
          if (/^[A-Z]/.test(text)) return 'type'
          return 'plain'
        },
      },
      ruby: {
        re: /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|:[A-Za-z_]\w*|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*[!?]?/gu,
        classify: (text, code, index) => {
          if (text.startsWith('#')) return 'comment'
          if (text.startsWith(':')) return 'property'
          return keywordClassifier(RUBY_KEYWORDS)(text, code, index)
        },
      },
      php: {
        re: /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$[A-Za-z_]\w*|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*/gu,
        classify: (text, code, index) => {
          if (text.startsWith('$')) return 'property'
          return keywordClassifier(PHP_KEYWORDS)(text, code, index)
        },
      },
      lua: {
        re: /--\[\[[\s\S]*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*/gu,
        classify: keywordClassifier(LUA_KEYWORDS),
      },
      config: {
        re: /^[ \t]*[#;][^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|^[ \t]*[A-Za-z_][\w.-]*(?=\s*[=:])|\b\d+(?:\.\d+)?\b/gmu,
        classify: (text, code, index) => {
          if (/^[ \t]*[#;]/u.test(text)) return 'comment'
          if (/^\s*"/u.test(text) || /^\s*'/u.test(text)) return 'string'
          if (/^[ \t]*[A-Za-z_]/u.test(text) && text.trim().length > 0) return 'property'
          if (/^[0-9]/u.test(text.trim())) return 'number'
          return 'plain'
        },
      },
      diff: {
        re: /^\+[^\n]*|^-[^\n]*|^@@[^\n]*/gmu,
        classify: (text) => (text.startsWith('+') ? 'string' : text.startsWith('-') ? 'keyword' : 'function'),
      },
      plain: null,
    }

    /* ------------------------------------------------------------------ *
     * Additional language support
     * ------------------------------------------------------------------ */

    const KOTLIN_KEYWORDS = new Set([
      'abstract', 'actual', 'annotation', 'as', 'break', 'by', 'catch', 'class', 'companion', 'const',
      'constructor', 'continue', 'crossinline', 'data', 'delegate', 'do', 'dynamic', 'else', 'enum', 'expect',
      'external', 'false', 'field', 'file', 'final', 'finally', 'for', 'fun', 'get', 'if', 'import', 'in',
      'infix', 'init', 'inline', 'inner', 'interface', 'internal', 'is', 'lateinit', 'noinline', 'null', 'object',
      'open', 'operator', 'out', 'override', 'package', 'param', 'private', 'property', 'protected', 'public',
      'reified', 'return', 'sealed', 'set', 'super', 'suspend', 'tailrec', 'this', 'throw', 'true', 'try',
      'typealias', 'typeof', 'val', 'var', 'vararg', 'when', 'where', 'while',
    ])

    const SCALA_KEYWORDS = new Set([
      'abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'enum', 'export', 'extends', 'extension', 'false',
      'final', 'finally', 'for', 'forSome', 'given', 'if', 'implicit', 'import', 'inline', 'lazy', 'match', 'new',
      'null', 'object', 'opaque', 'open', 'override', 'package', 'private', 'protected', 'return', 'sealed',
      'super', 'then', 'this', 'throw', 'trait', 'transparent', 'true', 'try', 'type', 'using', 'val', 'var',
      'while', 'with', 'yield', 'derives', 'end', 'infix', 'erased', 'tracking',
    ])

    const SWIFT_KEYWORDS = new Set([
      'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate', 'func', 'import', 'init', 'inout',
      'internal', 'let', 'open', 'operator', 'private', 'precedencegroup', 'protocol', 'public', 'rethrows', 'static',
      'struct', 'subscript', 'typealias', 'var', 'break', 'case', 'catch', 'continue', 'default', 'defer', 'do',
      'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat', 'return', 'switch', 'throw', 'throws', 'try',
      'where', 'while', 'as', 'any', 'await', 'async', 'actor', 'borrowing', 'consuming', 'dynamic', 'final', 'get',
      'indirect', 'infix', 'isolated', 'lazy', 'mutating', 'nonisolated', 'nonmutating', 'optional', 'override',
      'package', 'postfix', 'prefix', 'required', 'self', 'Self', 'set', 'some', 'super', 'sending', 'unowned',
      'weak', 'willSet', 'didSet', 'true', 'false', 'nil',
    ])

    const DART_KEYWORDS = new Set([
      'abstract', 'as', 'assert', 'async', 'await', 'base', 'break', 'case', 'catch', 'class', 'const', 'continue',
      'covariant', 'default', 'deferred', 'do', 'dynamic', 'else', 'enum', 'export', 'extends', 'extension',
      'external', 'factory', 'false', 'final', 'finally', 'for', 'Function', 'get', 'hide', 'if', 'implements',
      'import', 'in', 'interface', 'is', 'late', 'library', 'mixin', 'new', 'null', 'on', 'operator', 'part',
      'required', 'rethrow', 'return', 'sealed', 'set', 'show', 'static', 'super', 'switch', 'sync', 'this',
      'throw', 'true', 'try', 'type', 'typedef', 'var', 'void', 'when', 'while', 'with', 'yield',
    ])

    const GROOVY_KEYWORDS = new Set([
      'abstract', 'as', 'assert', 'break', 'case', 'catch', 'class', 'const', 'continue', 'def', 'default', 'do',
      'else', 'enum', 'extends', 'false', 'final', 'finally', 'for', 'goto', 'if', 'implements', 'import', 'in',
      'instanceof', 'interface', 'native', 'new', 'null', 'package', 'private', 'protected', 'public', 'return',
      'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'threadsafe', 'throw', 'throws', 'transient',
      'true', 'try', 'volatile', 'while', 'trait', 'var', 'val', 'it',
    ])

    const R_KEYWORDS = new Set([
      'if', 'else', 'for', 'while', 'repeat', 'function', 'return', 'next', 'break', 'in', 'library', 'require',
      'source', 'print', 'cat', 'paste', 'c', 'list', 'data.frame', 'matrix', 'vector', 'factor', 'ggplot', 'aes',
      'dplyr', 'mutate', 'filter', 'select', 'summarise', 'group_by',
    ])

    const PERL_KEYWORDS = new Set([
      'my', 'our', 'local', 'sub', 'use', 'no', 'package', 'require', 'do', 'if', 'elsif', 'else', 'unless', 'while',
      'until', 'for', 'foreach', 'continue', 'last', 'next', 'redo', 'return', 'die', 'warn', 'print', 'say', 'open',
      'close', 'defined', 'undef', 'ref', 'bless', 'new', 'qw', 'q', 'qq', 'and', 'or', 'not', 'eq', 'ne', 'lt',
      'gt', 'le', 'ge', 'cmp', 'scalar', 'wantarray', 'exists', 'delete', 'keys', 'values', 'each', 'push', 'pop',
      'shift', 'unshift', 'splice', 'join', 'split', 'map', 'grep', 'sort', 'reverse', 'length', 'substr', 'index',
      'rindex', 'sprintf', 'printf', 'chomp', 'chop', 'lc', 'uc', 'lcfirst', 'ucfirst',
    ])

    const POWERSHELL_KEYWORDS = new Set([
      'function', 'param', 'begin', 'process', 'end', 'if', 'else', 'elseif', 'foreach', 'for', 'while', 'do',
      'until', 'switch', 'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue', 'class', 'enum', 'using',
      'filter', 'workflow', 'in', 'not', 'and', 'or', 'true', 'false', 'null', 'trap', 'data', 'dynamicparam',
    ])

    const FSHARP_KEYWORDS = new Set([
      'let', 'use', 'match', 'with', 'function', 'fun', 'type', 'module', 'namespace', 'open', 'member', 'interface',
      'inherit', 'mutable', 'rec', 'and', 'async', 'task', 'yield', 'return', 'if', 'then', 'else', 'elif', 'for',
      'in', 'while', 'do', 'done', 'try', 'finally', 'raise', 'new', 'static', 'abstract', 'override', 'default',
      'struct', 'class', 'exception', 'delegate', 'val', 'void', 'null', 'true', 'false', 'base', 'this', 'upcast',
      'downcast', 'box', 'unbox', 'lazy', 'seq', 'list', 'array', 'option', 'result', 'when',
    ])

    const VB_KEYWORDS = new Set([
      'imports', 'namespace', 'class', 'module', 'sub', 'function', 'property', 'dim', 'as', 'new', 'public',
      'private', 'protected', 'friend', 'shared', 'static', 'readonly', 'writeonly', 'if', 'then', 'else',
      'elseif', 'end', 'for', 'each', 'next', 'while', 'do', 'loop', 'until', 'try', 'catch', 'finally', 'throw',
      'return', 'select', 'case', 'with', 'using', 'inherits', 'implements', 'interface', 'enum', 'structure',
      'byval', 'byref', 'optional', 'paramarray', 'handles', 'event', 'raiseevent', 'addhandler', 'removehandler',
      'get', 'set', 'mybase', 'myclass', 'me', 'nothing', 'true', 'false', 'and', 'or', 'not', 'xor', 'mod', 'is',
      'isnot', 'like', 'typeof', 'gettype', 'directcast', 'ctype', 'trycast', 'redim', 'erase', 'stop', 'goto',
      'resume', 'on', 'error',
    ])

    const OBJC_KEYWORDS = new Set([
      ...C_KEYWORDS,
      'id', 'instancetype', 'BOOL', 'YES', 'NO', 'nil', 'Nil', 'self', 'super', 'nonatomic', 'strong', 'weak',
      'copy', 'assign', 'retain', 'readonly', 'readwrite', 'atomic', 'nullable', 'nonnull',
      '@interface', '@implementation', '@protocol', '@end', '@class', '@property', '@synthesize', '@dynamic',
      '@selector', '@encode', '@import', '@autoreleasepool', '@try', '@catch', '@finally', '@throw',
      '@synchronized', '@optional', '@required', '@public', '@protected', '@private', '@package', '@defs',
      '@compatibility_alias', '@available',
    ])

    const PROTO_KEYWORDS = new Set([
      'syntax', 'package', 'import', 'option', 'message', 'enum', 'service', 'rpc', 'returns', 'stream', 'repeated',
      'optional', 'required', 'oneof', 'map', 'reserved', 'extend', 'extensions', 'group', 'weak', 'public',
      'edition', 'double', 'float', 'int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64', 'fixed32', 'fixed64',
      'sfixed32', 'sfixed64', 'bool', 'string', 'bytes',
    ])

    const GRAPHQL_KEYWORDS = new Set([
      'query', 'mutation', 'subscription', 'fragment', 'on', 'type', 'interface', 'union', 'enum', 'input',
      'scalar', 'schema', 'extend', 'directive', 'implements', 'repeatable', 'true', 'false', 'null',
    ])

    const TERRAFORM_KEYWORDS = new Set([
      'resource', 'data', 'variable', 'output', 'module', 'provider', 'terraform', 'locals', 'dynamic', 'for', 'in',
      'if', 'else', 'null', 'true', 'false', 'for_each', 'count', 'depends_on', 'lifecycle', 'provisioner',
      'connection', 'backend', 'required_providers', 'required_version', 'source', 'version', 'can', 'try', 'flatten',
      'concat', 'merge', 'lookup', 'file', 'templatefile', 'jsonencode', 'yamlencode', 'base64encode', 'cidrsubnet',
      'local', 'var', 'path', 'each', 'self', 'string', 'number', 'bool', 'list', 'map', 'object', 'tuple', 'set',
    ])

    const CMAKE_KEYWORDS = new Set([
      'if', 'elseif', 'else', 'endif', 'foreach', 'endforeach', 'function', 'endfunction', 'macro', 'endmacro',
      'while', 'endwhile', 'break', 'continue', 'return', 'set', 'unset', 'option', 'project',
      'cmake_minimum_required', 'include', 'find_package', 'add_executable', 'add_library', 'add_subdirectory',
      'target_link_libraries', 'target_include_directories', 'target_compile_features', 'target_compile_definitions',
      'install', 'message', 'list', 'string', 'file', 'configure_file', 'set_target_properties', 'enable_testing',
      'add_test', 'include_directories', 'link_directories', 'add_custom_command', 'add_custom_target',
    ])

    const DOCKER_KEYWORDS = new Set([
      'from', 'run', 'cmd', 'label', 'maintainer', 'expose', 'env', 'add', 'copy', 'entrypoint', 'volume', 'user',
      'workdir', 'arg', 'onbuild', 'stopsignal', 'healthcheck', 'shell', 'as',
    ])

    /**
     * Generic highlighter for C-like and hash-comment languages. It deliberately
     * stays small: comments, strings, numbers, attributes, keywords, functions and
     * capitalized types cover most source files, while dedicated highlighters below
     * handle languages with unusual syntax.
     */
    function codeHighlighter(keywords, options = {}) {
      const hash = options.hashComments === true
      const slash = options.slashComments !== false
      const atKeywords = options.atKeywords === true
      const caseInsensitive = options.caseInsensitive === true
      const attributes = options.attributes !== false
      const constants = new Set(
        (options.constants ?? ['true', 'false', 'null', 'nil', 'none', 'undefined']).map((value) => value.toLowerCase()),
      )
      const commentParts = []
      if (hash) commentParts.push('#[^\\n]*')
      if (slash) commentParts.push('\\/\\/[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/')
      const parts = [
        ...commentParts,
        '"""[\\s\\S]*?"""',
        "'''[\\s\\S]*?'''",
        '"(?:\\\\.|[^"\\\\\\n])*"',
        "'(?:\\\\.|[^'\\\\\\n])*'",
        '`(?:\\\\.|[^`\\\\])*`',
        '\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b',
        attributes || atKeywords ? '@[A-Za-z_]\\w*' : '',
        '[A-Za-z_]\\w*',
      ].filter((part) => part.length > 0)
      const re = new RegExp(parts.join('|'), 'gu')
      const keywordSet = caseInsensitive ? new Set([...keywords].map((value) => value.toLowerCase())) : keywords
      return {
        re,
        classify(text, code, index) {
          if (text.startsWith('//') || text.startsWith('/*') || (hash && text.startsWith('#'))) return 'comment'
          if (text.startsWith('"') || text.startsWith("'") || text.startsWith('`')) return 'string'
          if (text.startsWith('@')) {
            if (atKeywords && keywordSet.has(text)) return 'keyword'
            return 'attr'
          }
          if (/^[0-9]/.test(text)) return 'number'
          const key = caseInsensitive ? text.toLowerCase() : text
          if (constants.has(key.toLowerCase())) return 'constant'
          if (keywordSet.has(key)) return 'keyword'
          const after = code.slice(index + text.length)
          if (/^\s*\(/u.test(after)) return 'function'
          if (/^[A-Z]/.test(text)) return 'type'
          return 'plain'
        },
      }
    }

    Object.assign(HIGHLIGHTERS, {
      kotlin: codeHighlighter(KOTLIN_KEYWORDS),
      scala: codeHighlighter(SCALA_KEYWORDS),
      swift: codeHighlighter(SWIFT_KEYWORDS, { constants: ['true', 'false', 'nil'] }),
      dart: codeHighlighter(DART_KEYWORDS),
      groovy: codeHighlighter(GROOVY_KEYWORDS),
      r: codeHighlighter(R_KEYWORDS, {
        hashComments: true,
        slashComments: false,
        constants: ['true', 'false', 'null', 'na', 'nan', 'inf'],
      }),
      objectivec: codeHighlighter(OBJC_KEYWORDS, {
        atKeywords: true,
        constants: ['yes', 'no', 'nil'],
      }),
      proto: codeHighlighter(PROTO_KEYWORDS),
      graphql: codeHighlighter(GRAPHQL_KEYWORDS, { hashComments: true, slashComments: false }),
      terraform: codeHighlighter(TERRAFORM_KEYWORDS, { hashComments: true, slashComments: true }),
      cmake: codeHighlighter(CMAKE_KEYWORDS, { hashComments: true, slashComments: false }),
      perl: {
        re: /#[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`|\$[A-Za-z_]\w*|@[A-Za-z_]\w*|%[A-Za-z_]\w*|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*/gu,
        classify(text, code, index) {
          if (text.startsWith('#')) return 'comment'
          if (text.startsWith('"') || text.startsWith("'") || text.startsWith('`')) return 'string'
          if (/^[$@%]/u.test(text)) return 'property'
          if (/^[0-9]/.test(text)) return 'number'
          if (PERL_KEYWORDS.has(text)) return 'keyword'
          const after = code.slice(index + text.length)
          if (/^\s*\(/u.test(after)) return 'function'
          if (/^[A-Z]/.test(text)) return 'type'
          return 'plain'
        },
      },
      powershell: {
        re: /<#[\s\S]*?#>|#[^\n]*|@?"(?:`[\s\S]|[^"`])*"|@?'(?:''|[^'])*'|\$[A-Za-z_][\w:]*|\b\d+(?:\.\d+)?\b|[A-Za-z_][\w-]*/gu,
        classify(text, code, index) {
          if (text.startsWith('<#') || text.startsWith('#')) return 'comment'
          if (text.startsWith('"') || text.startsWith("'")) return 'string'
          if (text.startsWith('@')) return 'string'
          if (text.startsWith('$')) return 'property'
          if (/^[0-9]/.test(text)) return 'number'
          if (POWERSHELL_KEYWORDS.has(text.toLowerCase())) return 'keyword'
          if (text.includes('-')) return 'function'
          const after = code.slice(index + text.length)
          if (/^\s*\(/u.test(after)) return 'function'
          if (/^[A-Z]/.test(text)) return 'type'
          return 'plain'
        },
      },
      fsharp: {
        re: /\/\/[^\n]*|\(\*[\s\S]*?\*\)|"""(?:[\s\S]*?)"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*'?/gu,
        classify(text, code, index) {
          if (text.startsWith('//') || text.startsWith('(*')) return 'comment'
          if (text.startsWith('"') || text.startsWith("'")) return 'string'
          if (/^[0-9]/.test(text)) return 'number'
          if (FSHARP_KEYWORDS.has(text)) return 'keyword'
          const after = code.slice(index + text.length)
          if (/^\s*\(/u.test(after)) return 'function'
          if (/^[A-Z]/.test(text)) return 'type'
          return 'plain'
        },
      },
      vb: {
        re: /'[^\n]*|\bREM\b[^\n]*|"(?:""|[^"\n])*"|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*/giu,
        classify(text, code, index) {
          if (text.startsWith("'") || /^rem\b/iu.test(text)) return 'comment'
          if (text.startsWith('"')) return 'string'
          if (/^[0-9]/.test(text)) return 'number'
          if (VB_KEYWORDS.has(text.toLowerCase())) return 'keyword'
          const after = code.slice(index + text.length)
          if (/^\s*\(/u.test(after)) return 'function'
          if (/^[A-Z]/.test(text)) return 'type'
          return 'plain'
        },
      },
      dockerfile: {
        re: /^[ \t]*#[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\$\{[A-Za-z_]\w*\}|\$[A-Za-z_]\w*|^[ \t]*[A-Za-z]+|\b\d+\b/gimu,
        classify(text) {
          if (/^[ \t]*#/u.test(text)) return 'comment'
          if (text.startsWith('"') || text.startsWith("'")) return 'string'
          if (text.startsWith('$')) return 'property'
          if (/^[ \t]*[A-Za-z]+/u.test(text)) {
            return DOCKER_KEYWORDS.has(text.trim().toLowerCase()) ? 'keyword' : 'plain'
          }
          if (/^[0-9]/.test(text)) return 'number'
          return 'plain'
        },
      },
      makefile: {
        re: /#[^\n]*|\$\([^)]*\)|\$\{[^}]*\}|^[ \t]*[A-Za-z0-9_./%:-]+(?=[ \t]*:)|^[ \t]*(?:include|-include|ifdef|ifndef|ifeq|ifneq|else|endif|define|endef|export|unexport|override|vpath)\b/gmu,
        classify(text) {
          if (text.startsWith('#')) return 'comment'
          if (text.startsWith('$')) return 'property'
          if (/^[ \t]*(?:include|-include|ifdef|ifndef|ifeq|ifneq|else|endif|define|endef|export|unexport|override|vpath)\b/u.test(text)) {
            return 'keyword'
          }
          return 'function'
        },
      },
      razor: {
        re: /@\*[\s\S]*?\*@|<!--[\s\S]*?-->|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|<\/?[A-Za-z][^>]*>|@[A-Za-z_]\w*|\b(?:0[xX][0-9a-fA-F_]+|\d[\d_]*(?:\.\d+)?)\b|[A-Za-z_]\w*/gu,
        classify(text, code, index) {
          if (text.startsWith('@*') || text.startsWith('<!--')) return 'comment'
          if (text.startsWith('"') || text.startsWith("'")) return 'string'
          if (text.startsWith('<')) return 'tag'
          if (text.startsWith('@')) return 'attr'
          if (/^[0-9]/.test(text)) return 'number'
          if (CSHARP_KEYWORDS.has(text)) return 'keyword'
          if (/^(?:true|false|null)$/.test(text)) return 'constant'
          const after = code.slice(index + text.length)
          if (/^\s*\(/u.test(after)) return 'function'
          if (/^[A-Z]/.test(text)) return 'type'
          return 'plain'
        },
      },
    })

    const TOKEN_CACHE = new Map()

    function tokenize(code, language) {
      const spec = HIGHLIGHTERS[language]
      if (!spec) return null
      if (code.length > 320000) return null
      const cacheKey = `${language}\u0000${code.length}\u0000${code.slice(0, 64)}`
      const cached = TOKEN_CACHE.get(cacheKey)
      if (cached !== undefined && cached.source === code) return cached.tokens
      const tokens = []
      spec.re.lastIndex = 0
      let last = 0
      let match
      while ((match = spec.re.exec(code)) !== null) {
        if (match[0].length === 0) {
          spec.re.lastIndex += 1
          continue
        }
        if (match.index > last) tokens.push({ text: code.slice(last, match.index) })
        tokens.push({ text: match[0], kind: spec.classify(match[0], code, match.index) })
        last = match.index + match[0].length
      }
      if (last < code.length) tokens.push({ text: code.slice(last) })
      if (TOKEN_CACHE.size > 40) TOKEN_CACHE.clear()
      TOKEN_CACHE.set(cacheKey, { source: code, tokens })
      return tokens
    }

    function Highlighted({ code, language }) {
      const tokens = useMemo(() => tokenize(code, language), [code, language])
      if (tokens === null) return code
      return tokens.map((token, index) =>
        token.kind === undefined || token.kind === 'plain'
          ? h('span', { key: index }, token.text)
          : h('span', { key: index, className: `ds-tok-${token.kind}` }, token.text),
      )
    }

    /* ------------------------------------------------------------------ *
     * Markdown rendering
     * ------------------------------------------------------------------ */

    function resolveRelative(baseFile, href) {
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/iu.test(href)) return href
      if (href.startsWith('/')) return href.replace(/^\/+/u, '')
      const clean = href.split('#')[0].split('?')[0]
      if (clean.length === 0) return href
      const segments = dirname(baseFile).length > 0 ? dirname(baseFile).split('/') : []
      for (const part of clean.split('/')) {
        if (part === '' || part === '.') continue
        if (part === '..') segments.pop()
        else segments.push(part)
      }
      return segments.join('/')
    }

    function inlineMarkdown(text, keyPrefix, context) {
      const nodes = []
      const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\n]+\*|_[^_\n]+_)|(!?\[[^\]\n]*\]\([^)\n]*\))|(https?:\/\/[^\s<)]+)/gu
      let last = 0
      let index = 0
      let match
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index))
        const token = match[0]
        const key = `${keyPrefix}-${String(index++)}`
        if (token.startsWith('`')) {
          nodes.push(h('code', { key, className: 'ds-md-inline-code' }, token.slice(1, -1)))
        } else if (token.startsWith('**') || token.startsWith('__')) {
          nodes.push(h('strong', { key }, inlineMarkdown(token.slice(2, -2), key, context)))
        } else if (token.startsWith('*') || token.startsWith('_')) {
          nodes.push(h('em', { key }, inlineMarkdown(token.slice(1, -1), key, context)))
        } else if (token.startsWith('![') || token.startsWith('[')) {
          const image = token.startsWith('![')
          const close = token.indexOf('](')
          const label = token.slice(image ? 2 : 1, close)
          const target = token.slice(close + 2, -1).trim()
          if (image) {
            const source = resolveRelative(context.file, target)
            const url = /^https?:/iu.test(source) ? source : rawUrl(context.root, source)
            nodes.push(h('img', { key, src: url, alt: label, loading: 'lazy', referrerPolicy: 'no-referrer', className: 'ds-md-image' }))
          } else if (target.startsWith('#')) {
            nodes.push(h('a', { key, href: target, className: 'ds-md-link' }, inlineMarkdown(label, key, context)))
          } else {
            const external = /^(?:https?:|mailto:)/iu.test(target)
            const source = external ? target : resolveRelative(context.file, target)
            const href = external ? target : `#${encodeURIComponent(source)}`
            nodes.push(
              h(
                'a',
                {
                  key,
                  href,
                  target: external ? '_blank' : undefined,
                  rel: external ? 'noreferrer' : undefined,
                  className: 'ds-md-link',
                  onClick: external
                    ? undefined
                    : (event) => {
                        event.preventDefault()
                        context.onOpenPath?.(source)
                      },
                },
                inlineMarkdown(label, key, context),
              ),
            )
          }
        } else if (token.startsWith('http')) {
          nodes.push(
            h('a', { key, href: token, target: '_blank', rel: 'noreferrer', className: 'ds-md-link' }, token),
          )
        }
        last = match.index + token.length
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    function parseTableRow(line) {
      const trimmed = line.trim().replace(/^\|/u, '').replace(/\|$/u, '')
      return trimmed.split('|').map((cell) => cell.trim())
    }

    function MarkdownView({ text, root, file, onOpenPath, t }) {
      const context = { root, file, onOpenPath }
      const blocks = useMemo(() => {
        const lines = text.replace(/\r\n?/gu, '\n').split('\n')
        const result = []
        let index = 0
        let key = 0
        while (index < lines.length) {
          const line = lines[index]
          if (line.trim().length === 0) {
            index += 1
            continue
          }
          const fence = line.match(/^\s*(```+|~~~+)\s*([\w+#.-]*)\s*$/u)
          if (fence !== null) {
            const body = []
            index += 1
            while (index < lines.length && !new RegExp(`^\\s*${fence[1]}`).test(lines[index])) {
              body.push(lines[index])
              index += 1
            }
            index += 1
            result.push({ kind: 'code', key: `b${String(key++)}`, language: fence[2], text: body.join('\n') })
            continue
          }
          const heading = line.match(/^(#{1,6})\s+(.*)$/u)
          if (heading !== null) {
            result.push({
              kind: 'heading',
              key: `b${String(key++)}`,
              level: heading[1].length,
              text: heading[2].trim(),
            })
            index += 1
            continue
          }
          if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(line)) {
            result.push({ kind: 'hr', key: `b${String(key++)}` })
            index += 1
            continue
          }
          if (/^\s*\|.*\|\s*$/u.test(line) && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/u.test(lines[index + 1])) {
            const header = parseTableRow(line)
            index += 2
            const rows = []
            while (index < lines.length && /^\s*\|.*\|\s*$/u.test(lines[index])) {
              rows.push(parseTableRow(lines[index]))
              index += 1
            }
            result.push({ kind: 'table', key: `b${String(key++)}`, header, rows })
            continue
          }
          if (/^\s*>/u.test(line)) {
            const body = []
            while (index < lines.length && /^\s*>/u.test(lines[index])) {
              body.push(lines[index].replace(/^\s*>\s?/u, ''))
              index += 1
            }
            result.push({ kind: 'quote', key: `b${String(key++)}`, text: body.join('\n') })
            continue
          }
          const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/u)
          if (listMatch !== null) {
            const ordered = /\d/.test(listMatch[2])
            const items = []
            while (index < lines.length) {
              const item = lines[index].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/u)
              if (item === null) break
              items.push({ indent: item[1].length, text: item[3] })
              index += 1
              while (index < lines.length && /^\s{2,}\S/u.test(lines[index]) && !/^(\s*)([-*+]|\d+\.)\s+/u.test(lines[index])) {
                const lastItem = items[items.length - 1]
                lastItem.text += ` ${lines[index].trim()}`
                index += 1
              }
            }
            result.push({ kind: 'list', key: `b${String(key++)}`, ordered, items })
            continue
          }
          const paragraph = [line.trim()]
          index += 1
          while (index < lines.length) {
            const next = lines[index]
            if (
              next.trim().length === 0 ||
              /^(#{1,6})\s+/u.test(next) ||
              /^\s*(```+|~~~+)/u.test(next) ||
              /^\s*>/u.test(next) ||
              /^\s*\|.*\|\s*$/u.test(next) ||
              /^(\s*)([-*+]|\d+\.)\s+/u.test(next) ||
              /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(next)
            ) {
              break
            }
            paragraph.push(next.trim())
            index += 1
          }
          result.push({ kind: 'paragraph', key: `b${String(key++)}`, text: paragraph.join(' ') })
        }
        return result
      }, [text])

      if (text.trim().length === 0) return h('div', { className: 'ds-md ds-md-empty' }, t('markdown.empty'))

      return h(
        'div',
        { className: 'ds-md' },
        h(
          'div',
          { className: 'ds-md-inner' },
          blocks.map((block) => {
            if (block.kind === 'heading') {
              return h(
                `h${String(block.level)}`,
                { key: block.key, className: 'ds-md-heading' },
                inlineMarkdown(block.text, block.key, context),
              )
            }
            if (block.kind === 'code') {
              return h(
                'pre',
                { key: block.key, className: 'ds-md-pre', 'data-language': block.language || undefined },
                h('code', null, block.text),
              )
            }
            if (block.kind === 'hr') return h('hr', { key: block.key, className: 'ds-md-hr' })
            if (block.kind === 'quote') {
              return h('blockquote', { key: block.key, className: 'ds-md-quote' }, inlineMarkdown(block.text, block.key, context))
            }
            if (block.kind === 'table') {
              return h(
                'div',
                { key: block.key, className: 'ds-md-tablewrap' },
                h(
                  'table',
                  { className: 'ds-md-table' },
                  h(
                    'thead',
                    null,
                    h(
                      'tr',
                      null,
                      block.header.map((cell, cellIndex) =>
                        h('th', { key: `${block.key}-h${String(cellIndex)}` }, inlineMarkdown(cell, `${block.key}-h${String(cellIndex)}`, context)),
                      ),
                    ),
                  ),
                  h(
                    'tbody',
                    null,
                    block.rows.map((row, rowIndex) =>
                      h(
                        'tr',
                        { key: `${block.key}-r${String(rowIndex)}` },
                        row.map((cell, cellIndex) =>
                          h('td', { key: `${block.key}-r${String(rowIndex)}-${String(cellIndex)}` }, inlineMarkdown(cell, `${block.key}-r${String(rowIndex)}-${String(cellIndex)}`, context)),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            }
            if (block.kind === 'list') {
              return h(
                block.ordered ? 'ol' : 'ul',
                { key: block.key, className: 'ds-md-list' },
                block.items.map((item, itemIndex) =>
                  h(
                    'li',
                    {
                      key: `${block.key}-${String(itemIndex)}`,
                      style: item.indent >= 2 ? { marginLeft: `${String(Math.min(item.indent, 8) * 4)}px` } : undefined,
                    },
                    inlineMarkdown(item.text, `${block.key}-${String(itemIndex)}`, context),
                  ),
                ),
              )
            }
            return h('p', { key: block.key, className: 'ds-md-para' }, inlineMarkdown(block.text, block.key, context))
          }),
        ),
      )
    }

    /* ------------------------------------------------------------------ *
     * Icons
     * ------------------------------------------------------------------ */

    function icon(size, ...args) {
      let extra = {}
      if (args.length > 0) {
        const last = args[args.length - 1]
        if (
          last !== null &&
          typeof last === 'object' &&
          !React.isValidElement(last) &&
          (Object.getPrototypeOf(last) === Object.prototype || Object.getPrototypeOf(last) === null)
        ) {
          extra = args.pop()
        }
      }
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          ...extra,
        },
        ...args,
      )
    }

    function ChevronIcon() {
      return icon(14, h('path', { d: 'M6 3.5 10.5 8 6 12.5' }))
    }

    function ChevronUpIcon() {
      return icon(14, h('path', { d: 'M3.5 9.75 8 5.25l4.5 4.5' }))
    }

    function ChevronDownIcon() {
      return icon(14, h('path', { d: 'M3.5 6.25 8 10.75l4.5-4.5' }))
    }

    function FolderIcon({ open }) {
      return open
        ? icon(15, h('path', { d: 'M1.75 4.5h4l1.2 1.5h7.3v6.25a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1Z' }), h('path', { d: 'M1.75 4.5V3.25a1 1 0 0 1 1-1h3l1.2 1.5' }))
        : icon(15, h('path', { d: 'M1.75 12.5V3.25a1 1 0 0 1 1-1h3.1l1.3 1.6h5.85a1 1 0 0 1 1 1v7.65a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1Z' }))
    }

    function PageIcon() {
      return icon(15, h('path', { d: 'M3.5 1.75h5.2l3.3 3.3v9.2H3.5Z' }), h('path', { d: 'M8.5 1.75v3.5H12' }))
    }

    function glyphGroup(name) {
      const ext = extensionOf(name)
      const base = basename(name).toLowerCase()
      if (base === 'dockerfile' || base.startsWith('dockerfile.') || base === 'containerfile' || base.startsWith('containerfile.') || base === 'makefile' || base.startsWith('makefile.') || base === 'gnumakefile' || base === 'cmakelists.txt') return 'code'
      if (ext === 'pdf') return 'pdf'
      if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown'
      if (IMAGE_EXTENSIONS.has(ext)) return 'image'
      if (['json', 'yml', 'yaml', 'toml', 'ini', 'lock'].includes(ext)) return 'data'
      if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'vue', 'svelte'].includes(ext)) return 'code'
      if (['css', 'scss', 'less', 'html', 'htm', 'xml', 'svg', 'cshtml', 'razor'].includes(ext)) return 'web'
      if (['py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'cs', 'csx', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'm', 'mm', 'php', 'lua', 'sh', 'bash', 'zsh', 'swift', 'dart', 'scala', 'sc', 'groovy', 'gradle', 'r', 'pl', 'pm', 'ps1', 'psm1', 'fs', 'fsx', 'fsi', 'vb', 'vbs', 'proto', 'graphql', 'gql', 'tf', 'tfvars', 'hcl', 'cmake', 'dockerfile', 'mk'].includes(ext)) return 'code'
      return 'plain'
    }

    function FileGlyph({ name, size = 15 }) {
      return h('span', { className: `ds-fileglyph ds-fileglyph-${glyphGroup(name)}`, style: { width: `${String(size)}px`, height: `${String(size)}px` } }, h(PageIcon))
    }

    function PanelGlyph({ size = 20, active = false }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          style: { color: active ? 'var(--dsw-alias-brand-primary)' : undefined },
          'aria-hidden': true,
        },
        h('path', { d: 'M3 8V5.75A1.75 1.75 0 0 1 4.75 4h4.4l1.6 2.1h7.5A1.75 1.75 0 0 1 20 7.85v9.4a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 17.25Z' }),
        h('path', { d: 'M9.75 11.5 7.5 14l2.25 2.5' }),
        h('path', { d: 'M14.25 11.5 16.5 14l-2.25 2.5' }),
        h('path', { d: 'M12.75 10.75 11.25 17.25' }),
      )
    }

    function NewFileIcon() {
      return icon(16, h('path', { d: 'M3.75 1.75h5.1l3.4 3.4v9.1H3.75Z' }), h('path', { d: 'M8.75 1.75v3.5h3.5' }), h('path', { d: 'M12 9.5v4M10 11.5h4' }))
    }

    function NewFolderIcon() {
      return icon(16, h('path', { d: 'M1.75 12.5V3.25a1 1 0 0 1 1-1h3.1l1.3 1.6h4.85a1 1 0 0 1 1 1v7.65a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1Z' }), h('path', { d: 'M9.5 8.75v4M7.5 10.75h4' }))
    }

    function RefreshIcon() {
      return icon(16, h('path', { d: 'M13.25 7A5.4 5.4 0 1 0 13 10.5' }), h('path', { d: 'M13.5 2.75V6.5h-3.75' }))
    }

    function SaveIcon() {
      return icon(15, h('path', { d: 'M2.75 2.75h8.5l2 2v8.5H2.75Z' }), h('path', { d: 'M5 2.75v3.5h5.5v-3.5' }), h('path', { d: 'M5 13.25v-4h6v4' }))
    }

    function ExternalIcon() {
      return icon(14, h('path', { d: 'M6.5 3.25H3.25v9.5h9.5V9.5' }), h('path', { d: 'M9 2.75h4.25V7' }), h('path', { d: 'M13.25 2.75 7.5 8.5' }))
    }

    function GlobeIcon() {
      return icon(15, h('circle', { cx: 8, cy: 8, r: 6.25 }), h('path', { d: 'M1.75 8h12.5' }), h('path', { d: 'M8 1.75c2.1 2 2.1 10.5 0 12.5M8 1.75c-2.1 2-2.1 10.5 0 12.5' }))
    }

    function ArrowLeftIcon() {
      return icon(14, h('path', { d: 'M12.5 8h-10M6.5 3.5 2 8l4.5 4.5' }))
    }

    function ArrowRightIcon() {
      return icon(14, h('path', { d: 'M3.5 8h10M9.5 3.5 14 8l-4.5 4.5' }))
    }

    function MonitorIcon() {
      return icon(15, h('rect', { x: 1.75, y: 2.5, width: 12.5, height: 8.5, rx: 1 }), h('path', { d: 'M8 11v2.5M5 13.5h6' }))
    }

    function PhoneIcon() {
      return icon(15, h('rect', { x: 4.25, y: 1.75, width: 7.5, height: 12.5, rx: 1.5 }), h('path', { d: 'M7 12.5h2' }))
    }

    function RotateIcon() {
      return icon(15, h('path', { d: 'M12.75 6.5V3.25H9.5' }), h('path', { d: 'M12.5 3.5a5.5 5.5 0 1 0 1 6.5' }))
    }

    function PanelLeftIcon() {
      return icon(15, h('rect', { x: 1.75, y: 2.75, width: 11.5, height: 9.5, rx: 1 }), h('path', { d: 'M5.75 2.75v9.5' }))
    }

    function PanelRightIcon() {
      return icon(15, h('rect', { x: 1.75, y: 2.75, width: 11.5, height: 9.5, rx: 1 }), h('path', { d: 'M10.25 2.75v9.5' }))
    }

    function TerminalIcon() {
      return icon(15, h('rect', { x: 2, y: 3, width: 11, height: 9, rx: 1 }), h('path', { d: 'M4.5 6.25 6.5 8l-2 1.75M7.75 9.75h3' }))
    }

    function ChatIcon() {
      return icon(16,
        h('path', { d: 'M2.25 3.25h11.5v7.25H7l-3.25 2.5v-2.5H2.25Z' }),
        h('circle', { cx: 5.75, cy: 6.9, r: 0.65, fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: 8, cy: 6.9, r: 0.65, fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: 10.25, cy: 6.9, r: 0.65, fill: 'currentColor', stroke: 'none' }),
      )
    }

    function PanelTopIcon() {
      return icon(15, h('rect', { x: 1.75, y: 2.75, width: 11.5, height: 9.5, rx: 1 }), h('path', { d: 'M1.75 6h11.5' }))
    }

    function MaximizeIcon() {
      return icon(15, h('path', { d: 'M6 2H2v4M9 2h4v4M2 9v4h4M13 9v4H9' }))
    }

    function MinimizeIcon() {
      return icon(15, h('path', { d: 'M6 2v4H2M9 2v4h4M2 9h4v4M13 9H9v4' }))
    }

    function CloseIcon() {
      return icon(12, h('path', { d: 'M4 4l8 8M12 4l-8 8' }))
    }

    function CodeIcon() {
      return icon(15, h('path', { d: 'M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4' }))
    }

    function EyeIcon() {
      return icon(15, h('path', { d: 'M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8Z' }), h('circle', { cx: 8, cy: 8, r: 1.9 }))
    }

    function TrashIcon() {
      return icon(14, h('path', { d: 'M3 4.25h10M6.25 4.25V2.75h3.5v1.5M4.25 4.25l.6 9h6.3l.6-9' }))
    }

    function PencilIcon() {
      return icon(14, h('path', { d: 'M10.5 2.75l2.75 2.75L5.5 13.25H2.75V10.5Z' }))
    }

    function CopyIcon() {
      return icon(
        15,
        h('rect', { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.3 }),
        h('path', { d: 'M10.5 5.5V3.25a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1H5.5' }),
        h('path', { d: 'M7.5 8.5h4' }),
        h('path', { d: 'M7.5 10.75h2.75' }),
      )
    }

    function CutIcon() {
      return icon(15,
        h('circle', { cx: 4, cy: 3.5, r: 1.5 }),
        h('circle', { cx: 4, cy: 11.5, r: 1.5 }),
        h('path', { d: 'M5.2 4.6 12.5 12' }),
        h('path', { d: 'M5.2 10.4 12.5 3' }),
      )
    }

    function PasteIcon() {
      return icon(15,
        h('rect', { x: 3.25, y: 3.25, width: 9.5, height: 10, rx: 1.3 }),
        h('path', { d: 'M6 3.25V2.25h4v1' }),
        h('path', { d: 'M6 7h4.5' }),
        h('path', { d: 'M6 10h3' }),
      )
    }

    /* ------------------------------------------------------------------ *
     * Store
     * ------------------------------------------------------------------ */

    function readStorage(key) {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    }

    function writeStorage(key, value) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* storage may be unavailable; the UI still works for this mount */
      }
    }

    /** Read locally hidden workspace paths. */
    function readHiddenRoots() {
      const raw = readStorage(HIDDEN_ROOTS_KEY)
      if (typeof raw !== 'string' || raw.length === 0) return []
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((path) => typeof path === 'string' && path.length > 0) : []
      } catch {
        return []
      }
    }

    /** Read the per-root favorites map, dropping malformed entries. */
    function readFavorites() {
      const raw = readStorage(FAVORITES_KEY)
      if (typeof raw !== 'string' || raw.length === 0) return {}
      try {
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        const result = {}
        for (const [root, list] of Object.entries(parsed)) {
          if (!Array.isArray(list)) continue
          result[root] = list.filter(
            (item) =>
              item !== null &&
              typeof item === 'object' &&
              typeof item.path === 'string' &&
              item.path.length > 0 &&
              typeof item.name === 'string' &&
              (item.type === 'file' || item.type === 'directory'),
          )
        }
        return result
      } catch {
        return {}
      }
    }

    function isSshRootPath(value) {
      return typeof value === 'string' && /^ssh:\/\//iu.test(value)
    }

    function readSshRoots() {
      const raw = readStorage(SSH_ROOTS_KEY)
      if (typeof raw !== 'string' || raw.length === 0) return []
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed)
          ? [...new Set(parsed.filter((item) => isSshRootPath(item) && item.length <= 4096))]
          : []
      } catch {
        return []
      }
    }

    function writeSshRoots(list) {
      writeStorage(SSH_ROOTS_KEY, JSON.stringify([...new Set(list.filter((item) => isSshRootPath(item)))]))
    }

    function sshRootTitle(spec) {
      try {
        const url = new URL(spec)
        const remotePath = decodeURIComponent(url.pathname)
        const base = remotePath.split('/').filter((part) => part.length > 0).at(-1)
        return base === undefined ? `${url.host}` : `${url.host}/${base}`
      } catch {
        return spec
      }
    }

    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        get: () => state,
        set: (next) => {
          const value = typeof next === 'function' ? next(state) : next
          if (value === state) return
          state = value
          for (const listener of [...listeners]) listener()
        },
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    function useStore(store) {
      const [value, setValue] = useState(store.get)
      useEffect(() => {
        setValue(store.get())
        return store.subscribe(() => setValue(store.get()))
      }, [store])
      return value
    }

    function initialState() {
      const width = Number.parseInt(readStorage(WIDTH_KEY) ?? '', 10)
      return {
        ready: false,
        loadingRoots: false,
        startError: null,
        roots: [],
        root: null,
        rootTitle: '',
        levels: {},
        expanded: {},
        selected: null,
        tabs: [],
        active: null,
        treeWidth: Number.isFinite(width) ? Math.min(560, Math.max(180, width)) : 260,
        showHidden: readStorage(HIDDEN_KEY) === '1',
        favorites: readFavorites(),
        favoritesOpen: readStorage(FAVORITES_OPEN_KEY) !== '0',
        hiddenRoots: readHiddenRoots(),
        wordWrap: readStorage(WRAP_KEY) === '1',
      }
    }

    /* ------------------------------------------------------------------ *
     * Code editor
     * ------------------------------------------------------------------ */

    function CodeEditor({ tab, language, onChange, onSave, onCursor, onSelection, t, wrap }) {
      const textareaRef = useRef(null)
      const preRef = useRef(null)
      const gutterRef = useRef(null)
      const areaRef = useRef(null)
      const measureRef = useRef(null)
      const pendingSelection = useRef(null)
      const findInputRef = useRef(null)
      const lastRevealRef = useRef(null)
      const selectionKeyRef = useRef('')
      const [contentWidth, setContentWidth] = useState(0)
      const [fontSpec, setFontSpec] = useState('')
      const [findOpen, setFindOpen] = useState(false)
      const [findQuery, setFindQuery] = useState('')
      const [replaceQuery, setReplaceQuery] = useState('')
      const [findCase, setFindCase] = useState(false)
      const [findIndex, setFindIndex] = useState(-1)
      const value = tab.content
      const lines = useMemo(() => value.split('\n'), [value])
      const tokens = useMemo(() => tokenize(value, language.id), [value, language.id])
      const findMatches = useMemo(() => {
        if (!findOpen || findQuery.length === 0) return []
        const haystack = findCase ? value : value.toLowerCase()
        const needle = findCase ? findQuery : findQuery.toLowerCase()
        const matches = []
        let index = haystack.indexOf(needle)
        while (index !== -1) {
          matches.push({ start: index, end: index + needle.length })
          index = haystack.indexOf(needle, index + Math.max(1, needle.length))
        }
        return matches
      }, [findOpen, findQuery, findCase, value])

      useEffect(() => {
        const textarea = textareaRef.current
        if (textarea === null) return
        const style = window.getComputedStyle(textarea)
        setFontSpec(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`)
        const measure = () => setContentWidth(Math.max(40, textarea.clientWidth - 32))
        measure()
        if (typeof ResizeObserver === 'undefined') {
          window.addEventListener('resize', measure)
          return () => window.removeEventListener('resize', measure)
        }
        const observer = new ResizeObserver(measure)
        observer.observe(textarea)
        return () => observer.disconnect()
      }, [])

      useEffect(() => {
        const textarea = textareaRef.current
        if (textarea === null) return
        const width = Math.max(40, textarea.clientWidth - 32)
        setContentWidth((previous) => (Math.abs(previous - width) > 1 ? width : previous))
      }, [value, wrap])

      const lineRows = useMemo(() => {
        if (!wrap || contentWidth <= 0 || lines.length === 0) return null
        let context = measureRef.current
        if (context === null) {
          const canvas = document.createElement('canvas')
          context = canvas.getContext('2d')
          if (context === null) return null
          measureRef.current = context
        }
        context.font = fontSpec || '13px monospace'
        return lines.map((line) => {
          if (line.length === 0) return 1
          const measurable = line.includes('\t') ? line.replace(/\t/g, '  ') : line
          return Math.max(1, Math.ceil(context.measureText(measurable).width / contentWidth))
        })
      }, [wrap, lines, contentWidth, fontSpec])

      useEffect(() => {
        syncScroll()
      }, [wrap, value, lineRows])

      useEffect(() => {
        const pending = pendingSelection.current
        if (pending === null) return
        pendingSelection.current = null
        const textarea = textareaRef.current
        if (textarea === null) return
        textarea.selectionStart = pending.start
        textarea.selectionEnd = pending.end
        textarea.scrollTop = pending.scrollTop
        syncScroll()
      }, [value])

      useEffect(() => {
        setFindOpen(false)
        setFindQuery('')
        setFindIndex(-1)
        lastRevealRef.current = null
        selectionKeyRef.current = ''
      }, [tab.path])

      useEffect(() => {
        if (findIndex >= findMatches.length) setFindIndex(findMatches.length === 0 ? -1 : 0)
      }, [findMatches.length, findIndex])

      useEffect(() => {
        const reveal = tab.reveal
        const textarea = textareaRef.current
        if (reveal === null || reveal === undefined || textarea === null || tab.loading) return
        const key = `${tab.path}:${String(reveal.line)}:${String(reveal.column)}:${String(reveal.nonce ?? '')}`
        if (lastRevealRef.current === key) return
        lastRevealRef.current = key
        const targetLine = Math.max(1, Number(reveal.line) || 1)
        let index = 0
        for (let line = 0; line < targetLine - 1 && line < lines.length; line += 1) index += lines[line].length + 1
        const lineText = lines[targetLine - 1] ?? ''
        index += Math.min(Math.max(0, (Number(reveal.column) || 1) - 1), lineText.length)
        textarea.setSelectionRange(index, index)
        textarea.focus()
        textarea.scrollTop = Math.max(0, (targetLine - 3) * 20)
        syncScroll()
      }, [tab.reveal, tab.loading, tab.path, value])

      function syncScroll() {
        const textarea = textareaRef.current
        const pre = preRef.current
        const gutter = gutterRef.current
        if (textarea === null) return
        if (pre !== null) {
          pre.scrollTop = textarea.scrollTop
          pre.scrollLeft = textarea.scrollLeft
        }
        if (gutter !== null) gutter.style.transform = `translateY(${String(-textarea.scrollTop)}px)`
      }

      function applyChange(nextValue, selectionStart, selectionEnd) {
        const textarea = textareaRef.current
        pendingSelection.current = {
          start: selectionStart,
          end: selectionEnd,
          scrollTop: textarea === null ? 0 : textarea.scrollTop,
        }
        onChange(nextValue)
      }

      function reportCursor() {
        const textarea = textareaRef.current
        if (textarea === null) return
        const before = value.slice(0, textarea.selectionStart)
        const line = before.split('\n').length
        const column = before.length - before.lastIndexOf('\n')
        onCursor?.({ line, column })
        const key = `${String(textarea.selectionStart)}:${String(textarea.selectionEnd)}:${String(value.length)}`
        if (selectionKeyRef.current !== key) {
          selectionKeyRef.current = key
          onSelection?.(
            textarea.selectionEnd > textarea.selectionStart
              ? {
                  start: textarea.selectionStart,
                  end: textarea.selectionEnd,
                  text: value.slice(textarea.selectionStart, textarea.selectionEnd),
                }
              : null,
          )
        }
      }

      function openFind() {
        const textarea = textareaRef.current
        if (textarea !== null && textarea.selectionEnd > textarea.selectionStart) {
          const selected = value.slice(textarea.selectionStart, textarea.selectionEnd)
          if (selected.length > 0 && !selected.includes('\n') && selected.length <= 200) setFindQuery(selected)
        }
        setFindIndex(-1)
        setFindOpen(true)
        window.setTimeout(() => findInputRef.current?.focus(), 0)
      }

      function selectFindMatch(index) {
        const match = findMatches[index]
        const textarea = textareaRef.current
        if (match === undefined || textarea === null) return
        textarea.focus()
        textarea.setSelectionRange(match.start, match.end)
        const line = value.slice(0, match.start).split('\n').length
        textarea.scrollTop = Math.max(0, (line - 3) * 20)
        syncScroll()
      }

      function findNext(delta) {
        if (findMatches.length === 0) return
        const current = findIndex < 0 ? (delta > 0 ? -1 : 0) : findIndex
        const next = (current + delta + findMatches.length) % findMatches.length
        setFindIndex(next)
        selectFindMatch(next)
      }

      function replaceCurrent() {
        if (findMatches.length === 0) return
        const index = findIndex < 0 ? 0 : Math.min(findIndex, findMatches.length - 1)
        const match = findMatches[index]
        if (match === undefined) return
        const next = `${value.slice(0, match.start)}${replaceQuery}${value.slice(match.end)}`
        applyChange(next, match.start + replaceQuery.length, match.start + replaceQuery.length)
        setFindIndex(-1)
      }

      function replaceAllMatches() {
        if (findMatches.length === 0) return
        let next = value
        for (let index = findMatches.length - 1; index >= 0; index -= 1) {
          const match = findMatches[index]
          next = `${next.slice(0, match.start)}${replaceQuery}${next.slice(match.end)}`
        }
        applyChange(next, next.length, next.length)
        setFindIndex(-1)
      }

      function closeFind() {
        setFindOpen(false)
        setFindIndex(-1)
        textareaRef.current?.focus()
      }

      function onKeyDown(event) {
        const textarea = textareaRef.current
        if (textarea === null) return
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault()
          event.stopPropagation()
          openFind()
          return
        }
        if (event.key === 'Escape' && findOpen) {
          event.preventDefault()
          closeFind()
          return
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          event.stopPropagation()
          onSave()
          return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const next = `${value.slice(0, start)}  ${value.slice(end)}`
          applyChange(next, start + 2, start + 2)
          return
        }
        if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const lineStart = value.lastIndexOf('\n', start - 1) + 1
          const currentLine = value.slice(lineStart, start)
          const indent = currentLine.match(/^[\t ]*/u)?.[0] ?? ''
          const extra = /[{[(:]\s*$/u.test(currentLine) ? '  ' : ''
          event.preventDefault()
          const insertion = `\n${indent}${extra}`
          const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`
          applyChange(next, start + insertion.length, start + insertion.length)
        }
      }

      return h(
        'div',
        { className: 'ds-editor-shell' },
        findOpen
          ? h(
              'div',
              { className: 'ds-findbar' },
              h('input', {
                ref: findInputRef,
                className: 'ds-find-input',
                value: findQuery,
                placeholder: t('find.placeholder'),
                spellCheck: false,
                onChange: (event) => {
                  setFindQuery(event.target.value)
                  setFindIndex(-1)
                },
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    findNext(event.shiftKey ? -1 : 1)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    closeFind()
                  }
                },
              }),
              h(
                'span',
                { className: 'ds-find-count' },
                findQuery.length === 0
                  ? ''
                  : findMatches.length === 0
                    ? t('find.none')
                    : `${String(findIndex < 0 ? 1 : findIndex + 1)}/${String(findMatches.length)}`,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-find-btn',
                  title: t('find.prev'),
                  disabled: findMatches.length === 0,
                  onClick: () => findNext(-1),
                },
                '↑',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-find-btn',
                  title: t('find.next'),
                  disabled: findMatches.length === 0,
                  onClick: () => findNext(1),
                },
                '↓',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-toggle',
                  'data-active': findCase ? 'true' : undefined,
                  title: t('find.case'),
                  onClick: () => {
                    setFindCase((current) => !current)
                    setFindIndex(-1)
                  },
                },
                'Aa',
              ),
              h('input', {
                className: 'ds-find-input ds-find-replace',
                value: replaceQuery,
                placeholder: t('find.replacePlaceholder'),
                spellCheck: false,
                onChange: (event) => setReplaceQuery(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    replaceCurrent()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    closeFind()
                  }
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-find-btn ds-find-action',
                  disabled: findMatches.length === 0,
                  onClick: replaceCurrent,
                },
                t('find.replace'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-find-btn ds-find-action',
                  disabled: findMatches.length === 0,
                  onClick: replaceAllMatches,
                },
                t('find.replaceAll'),
              ),
              h(
                'button',
                { type: 'button', className: 'ds-find-btn', title: t('find.close'), onClick: closeFind },
                h(CloseIcon),
              ),
            )
          : null,
        h(
          'div',
          { className: 'ds-editor-wrap' },
        h(
          'div',
          { className: 'ds-gutter', 'aria-hidden': true },
          h(
            'div',
            { className: 'ds-gutter-inner', ref: gutterRef },
            lines.map((_, index) =>
              h(
                'div',
                {
                  key: index,
                  className: 'ds-gutter-line',
                  'data-current': false,
                  style: lineRows === null ? undefined : { height: `${String((lineRows[index] ?? 1) * 20)}px` },
                },
                String(index + 1),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'ds-code-area', ref: areaRef, 'data-wrap': wrap ? 'true' : undefined },
          h(
            'pre',
            { className: 'ds-pre', ref: preRef, 'aria-hidden': true },
            tokens === null ? value : h(Highlighted, { code: value, language: language.id }),
            value.endsWith('\n') ? '\n' : '',
          ),
          h('textarea', {
            ref: textareaRef,
            className: 'ds-ta',
            value,
            spellCheck: false,
            autoCapitalize: 'off',
            autoCorrect: 'off',
            wrap: wrap ? 'soft' : 'off',
            'aria-label': tab.name,
            onChange: (event) => {
              onChange(event.target.value)
              reportCursor()
            },
            onKeyDown,
            onKeyUp: reportCursor,
            onClick: reportCursor,
            onScroll: syncScroll,
            onSelect: reportCursor,
          }),
        ),
        ),
      )
    }

    /* ------------------------------------------------------------------ *
     * Small components
     * ------------------------------------------------------------------ */

    function NameInput({ initial, depth, placeholder, onCommit, onCancel, t }) {
      const [name, setName] = useState(initial ?? '')
      const ref = useRef(null)
      useEffect(() => {
        const input = ref.current
        if (input === null) return
        input.focus()
        const dot = (initial ?? '').lastIndexOf('.')
        if (dot > 0) input.setSelectionRange(0, dot)
        else input.select()
      }, [initial])
      return h(
        'div',
        { className: 'ds-row ds-row-draft', style: { paddingLeft: `${String(8 + depth * 14)}px` } },
        h('span', { className: 'ds-chevron' }, h('span', { style: { width: '14px' } })),
        h('input', {
          ref,
          className: 'ds-rowinput',
          value: name,
          placeholder: placeholder ?? '',
          spellCheck: false,
          onChange: (event) => setName(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onCommit(name)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onCancel()
            }
          },
          onBlur: () => onCancel(),
        }),
      )
    }

    function MenuItem({ label, shortcut, danger, onClick, children, disabled = false }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'ds-menu-item',
          role: 'menuitem',
          'data-danger': danger === true ? 'true' : undefined,
          disabled,
          onClick,
        },
        h('span', { className: 'ds-menu-label' }, children, h('span', null, label)),
        shortcut === undefined ? null : h('span', { className: 'ds-menu-kbd' }, shortcut),
      )
    }

    function PanelIcon({ size = 20, active = false }) {
      return h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
        h(PanelGlyph, { size, active }),
      )
    }

    /** Guide card artwork: the split-pane glyph sized for the guide's icon cell. */
    function GuideIcon() {
      return h(PanelGlyph, { size: 24 })
    }

    /** Tab chip content for the right-sidebar instance. */
    function makeIdeTitle(t) {
      return function IdeTitle() {
        return h(
          'span',
          { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
          h(PanelGlyph, { size: 16 }),
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t('panel.title')),
        )
      }
    }

    function ChevronLeftIcon() {
      return icon(14, h('path', { d: 'M10 3.5 5.5 8l4.5 4.5' }))
    }

    function CollapseAllIcon() {
      return icon(
        15,
        h('path', { d: 'M3 2.75h10' }),
        h('path', { d: 'M4 8.5 8 4.75l4 3.75' }),
        h('path', { d: 'M4 13 8 9.25l4 3.75' }),
      )
    }

    /** Current state: hidden dotfiles are not shown. */
    function HiddenFilesIcon() {
      return icon(
        15,
        h('path', { d: 'M3.5 1.75h5.2l3.3 3.3v9.2H3.5Z' }),
        h('path', { d: 'M8.7 1.75v3.4h3.3' }),
        h('circle', { cx: 8, cy: 9, r: 1.35, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M2.5 13.5 13.5 2.5' }),
      )
    }

    /** Current state: dotfiles are visible. */
    function VisibleFilesIcon() {
      return icon(
        15,
        h('path', { d: 'M3.5 1.75h5.2l3.3 3.3v9.2H3.5Z' }),
        h('path', { d: 'M8.7 1.75v3.4h3.3' }),
        h('circle', { cx: 8, cy: 9, r: 1.6, fill: 'currentColor', stroke: 'none' }),
      )
    }

    function GoIcon() {
      return icon(
        15,
        h('path', {
          d: 'M2.75 2.75 13.25 8 2.75 13.25 4.75 8Z',
          fill: 'currentColor',
          stroke: 'none',
        }),
      )
    }

    function StarIcon({ filled = false, size = 14, className }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: filled ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinejoin: 'round',
          className,
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M8 1.9l1.86 3.77 4.16.6-3.01 2.94.71 4.14L8 11.4l-3.72 1.95.71-4.14L1.98 6.27l4.16-.6Z' }),
      )
    }

    function WrapIcon() {
      return icon(16,
        h('path', { d: 'M2.5 3.5h10.75v4.75a2.25 2.25 0 0 1-2.25 2.25H4.5' }),
        h('path', { d: 'M7.25 8.25 4.5 10.5l2.75 2.25' }),
        { strokeWidth: 1.7 },
      )
    }

    function GitIcon() {
      return icon(16,
        h('circle', { cx: 4.25, cy: 3.75, r: 1.35 }),
        h('circle', { cx: 4.25, cy: 12.25, r: 1.35 }),
        h('circle', { cx: 11.75, cy: 6.25, r: 1.35 }),
        h('path', { d: 'M4.25 5.1v5.8' }),
        h('path', { d: 'M11.75 7.6c0 2.5-2.2 3.55-5.1 3.55H5.6' }),
      )
    }

    function RestoreIcon() {
      return icon(13,
        h('path', { d: 'M3 6.25A5.25 5.25 0 1 1 2.8 9.4' }),
        h('path', { d: 'M3.1 2.5v3.75H6.85' }),
      )
    }

    function StashIcon() {
      return icon(16,
        h('path', { d: 'M2.5 5.25h11v8.5h-11Z' }),
        h('path', { d: 'M1.75 2.25h12.5v3H1.75Z' }),
        h('path', { d: 'M6.5 8.25h3' }),
      )
    }

    function PlusIcon() {
      return icon(13, h('path', { d: 'M8 3v10' }), h('path', { d: 'M3 8h10' }))
    }

    function MinusIcon() {
      return icon(13, h('path', { d: 'M3 8h10' }))
    }

    function HomeIcon() {
      return icon(
        15,
        h('path', { d: 'M2.25 7.25 8 2.5l5.75 4.75' }),
        h('path', { d: 'M3.75 6.25v7.25h8.5V6.25' }),
        h('path', { d: 'M6.4 13.5V9.5h3.2v4' }),
      )
    }

    function UploadIcon() {
      return icon(16,
        h('path', { d: 'M8 10.5V6.5' }),
        h('path', { d: 'M8 2.5 4.25 6.75h7.5Z', fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M2.75 13.25h10.5' }),
        { strokeWidth: 1.9 },
      )
    }

    function DownloadIcon() {
      return icon(16,
        h('path', { d: 'M8 2.75v4' }),
        h('path', { d: 'M8 10.75 4.25 6.5h7.5Z', fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M2.75 13.25h10.5' }),
        { strokeWidth: 1.9 },
      )
    }

    function CompareIcon() {
      return icon(16,
        h('circle', { cx: 4.6, cy: 4.8, r: 2.15 }),
        h('circle', { cx: 11.4, cy: 11.2, r: 2.15 }),
        h('path', { d: 'M6.8 4.8h1.7a1.6 1.6 0 0 1 1.6 1.6v2.1' }),
        h('path', { d: 'M9.2 11.2H7.5a1.6 1.6 0 0 1-1.6-1.6V7.5' }),
      )
    }

    function SearchIcon() {
      return icon(15,
        h('circle', { cx: 6.5, cy: 6.5, r: 4.1 }),
        h('path', { d: 'm9.6 9.6 3.4 3.4' }),
      )
    }

    function HarnessIcon() {
      return icon(15,
        h('path', { d: 'M4.1 3.75h7.8v8.5H4.1Z' }),
        h('path', { d: 'M6 2v1.75M10 2v1.75M6 12.25V14M10 12.25V14' }),
        h('path', { d: 'M6.2 7h3.6' }),
      )
    }

    /* ------------------------------------------------------------------ *
     * Diff parsing for the side-by-side view
     * ------------------------------------------------------------------ */

    /** Rows the split view renders before it asks for the unified view. */
    const MAX_SPLIT_ROWS = 4000

    /**
     * Turn one unified diff into aligned old/new rows. File metadata
     * (`diff --git`, `index`, `---`, `+++`) is dropped because the modal header
     * already names the file; hunks, context, deletions and additions are kept.
     * Consecutive deletions and additions are paired row by row.
     * @param {string} text Unified diff text.
     * @returns {{rows: Array<object>, truncated: boolean}}
     */
    function parseUnifiedDiff(text) {
      const rows = []
      let truncated = false
      let oldLine = 0
      let newLine = 0
      let inHunk = false
      let pendingOld = []
      let pendingNew = []
      let noNewline = false

      const flush = () => {
        const count = Math.max(pendingOld.length, pendingNew.length)
        for (let index = 0; index < count; index += 1) {
          if (rows.length >= MAX_SPLIT_ROWS) {
            truncated = true
            break
          }
          const before = pendingOld[index]
          const after = pendingNew[index]
          rows.push({
            kind: before && after ? 'change' : before ? 'del' : 'add',
            oldNumber: before ? before.number : null,
            newNumber: after ? after.number : null,
            oldText: before ? before.text : '',
            newText: after ? after.text : '',
          })
        }
        pendingOld = []
        pendingNew = []
        if (noNewline) {
          if (rows.length < MAX_SPLIT_ROWS) rows.push({ kind: 'meta', text: '\\ No newline at end of file' })
          else truncated = true
          noNewline = false
        }
      }

      const pushRow = (row) => {
        if (rows.length >= MAX_SPLIT_ROWS) {
          truncated = true
          return
        }
        rows.push(row)
      }

      for (const raw of text.split('\n')) {
        if (truncated) break
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
        if (line.startsWith('@@')) {
          flush()
          if (truncated) break
          const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(line)
          if (match !== null) {
            oldLine = Number(match[1])
            newLine = Number(match[2])
            inHunk = true
          }
          pushRow({ kind: 'hunk', text: line })
          continue
        }
        if (!inHunk) continue
        if (line.startsWith('\\')) {
          noNewline = true
          continue
        }
        if (line.startsWith('-')) {
          pendingOld.push({ number: oldLine, text: line.slice(1) })
          oldLine += 1
          continue
        }
        if (line.startsWith('+')) {
          pendingNew.push({ number: newLine, text: line.slice(1) })
          newLine += 1
          continue
        }
        if (line.startsWith(' ')) {
          flush()
          if (truncated) break
          pushRow({
            kind: 'context',
            oldNumber: oldLine,
            newNumber: newLine,
            oldText: line.slice(1),
            newText: line.slice(1),
          })
          oldLine += 1
          newLine += 1
        }
      }
      flush()
      return { rows, truncated }
    }

    /**
     * Split a paired change into the unchanged prefix/suffix and the differing
     * middle, so the split view can emphasize only what changed.
     * @param {string} before Old line.
     * @param {string} after New line.
     * @returns {{old: {prefix: string, middle: string, suffix: string}, new: {prefix: string, middle: string, suffix: string}}}
     */
    function splitChangeParts(before, after) {
      let start = 0
      while (start < before.length && start < after.length && before[start] === after[start]) start += 1
      let oldEnd = before.length
      let newEnd = after.length
      while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
        oldEnd -= 1
        newEnd -= 1
      }
      return {
        old: { prefix: before.slice(0, start), middle: before.slice(start, oldEnd), suffix: before.slice(oldEnd) },
        new: { prefix: after.slice(0, start), middle: after.slice(start, newEnd), suffix: after.slice(newEnd) },
      }
    }

    /**
     * Approximate display width of one diff line in monospace columns. Tabs and
     * wide CJK/emoji characters occupy two columns; the result feeds the single
     * horizontal scrollbar so both sides can be measured together.
     */
    function diffLineWidth(text) {
      let width = 0
      for (const char of text) {
        if (char === '\t') {
          width += 2
          continue
        }
        const code = char.codePointAt(0) ?? 0
        const wide =
          (code >= 0x1100 && code <= 0x115f) ||
          code === 0x2329 ||
          code === 0x232a ||
          (code >= 0x2e80 && code <= 0xa4cf) ||
          (code >= 0xac00 && code <= 0xd7a3) ||
          (code >= 0xf900 && code <= 0xfaff) ||
          (code >= 0xfe10 && code <= 0xfe19) ||
          (code >= 0xfe30 && code <= 0xfe6f) ||
          (code >= 0xff00 && code <= 0xff60) ||
          (code >= 0xffe0 && code <= 0xffe6) ||
          (code >= 0x1f300 && code <= 0x1f64f) ||
          (code >= 0x1f900 && code <= 0x1f9ff)
        width += wide ? 2 : 1
      }
      return width
    }

    /** Widest rendered line, split across the two equal columns. */
    function splitDiffWidth(rows) {
      let width = 40
      for (const row of rows) {
        if (row.kind === 'hunk' || row.kind === 'meta') {
          width = Math.max(width, Math.ceil(diffLineWidth(row.text) / 2))
        } else {
          width = Math.max(width, diffLineWidth(row.oldText), diffLineWidth(row.newText))
        }
      }
      return Math.min(800, width)
    }

    /* ------------------------------------------------------------------ *
     * Git panel
     * ------------------------------------------------------------------ */

    /**
     * Read-only diff surface shown in the editor area. The split/unified choice
     * lives on the tab so the toolbar and the body stay in sync.
     */
    function DiffView({ tab, t }) {
      const text = tab.diff !== undefined && typeof tab.diff.text === 'string' ? tab.diff.text : ''
      const parsed = useMemo(() => parseUnifiedDiff(text), [text])
      const displayWidth = useMemo(() => splitDiffWidth(parsed.rows), [parsed])
      const viewRef = useRef(null)
      const barRef = useRef(null)
      useEffect(() => {
        if (viewRef.current !== null) viewRef.current.style.setProperty('--ds-diff-scroll', '0px')
        if (barRef.current !== null) barRef.current.scrollLeft = 0
      }, [text, tab.diffMode])
      if (tab.loading) {
        return h('div', { className: 'ds-empty' }, h('span', { className: 'ds-spinner' }), t('git.loadingDiff'))
      }
      if (tab.error !== null) {
        return h('div', { className: 'ds-diffview' }, h('div', { className: 'ds-git-error' }, tab.error))
      }
      if (text.trim().length === 0) {
        return h('div', { className: 'ds-empty' }, t('git.noDiff'))
      }
      const split = tab.diffMode !== 'unified' && parsed.rows.length > 0
      const renderCode = (value, parts, side) =>
        h(
          'span',
          { className: 'ds-git-split-code' },
          parts === null ? value : parts[side].prefix,
          parts !== null && parts[side].middle.length > 0
            ? h('span', { className: 'ds-git-split-emph' }, parts[side].middle)
            : null,
          parts === null ? null : parts[side].suffix,
        )
      const splitBody = h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'ds-git-diff-split-scroll' },
          parsed.truncated
            ? h('div', { className: 'ds-git-diff-note' }, t('git.diffTruncated', { n: String(MAX_SPLIT_ROWS) }))
            : null,
          h(
            'table',
            { className: 'ds-git-split' },
            h(
              'colgroup',
              null,
              h('col', { style: { width: '50%' } }),
              h('col', { style: { width: '50%' } }),
            ),
            h(
              'thead',
              null,
              h('tr', null, h('th', null, t('git.diffOldSide')), h('th', null, t('git.diffNewSide'))),
            ),
            h(
              'tbody',
              null,
              parsed.rows.map((row, index) => {
                if (row.kind === 'hunk' || row.kind === 'meta') {
                  return h(
                    'tr',
                    { key: index, className: row.kind === 'hunk' ? 'ds-git-split-hunk' : 'ds-git-split-meta' },
                    h('td', { colSpan: 2 }, row.text),
                  )
                }
                const oldEmpty = row.oldNumber === null
                const newEmpty = row.newNumber === null
                const parts = row.kind === 'change' ? splitChangeParts(row.oldText, row.newText) : null
                return h(
                  'tr',
                  { key: index, className: 'ds-git-split-row', 'data-kind': row.kind },
                  h(
                    'td',
                    { className: `ds-git-split-cell ds-git-split-old${oldEmpty ? ' ds-git-split-empty' : ''}` },
                    h(
                      'div',
                      { className: 'ds-git-split-clip' },
                      h('span', { className: 'ds-git-split-ln' }, oldEmpty ? '' : String(row.oldNumber)),
                      h('div', { className: 'ds-git-split-codebox' }, renderCode(row.oldText, parts, 'old')),
                    ),
                  ),
                  h(
                    'td',
                    { className: `ds-git-split-cell ds-git-split-new${newEmpty ? ' ds-git-split-empty' : ''}` },
                    h(
                      'div',
                      { className: 'ds-git-split-clip' },
                      h('span', { className: 'ds-git-split-ln' }, newEmpty ? '' : String(row.newNumber)),
                      h('div', { className: 'ds-git-split-codebox' }, renderCode(row.newText, parts, 'new')),
                    ),
                  ),
                )
              }),
            ),
          ),
        ),
        h(
          'div',
          {
            className: 'ds-git-diff-hscroll',
            ref: barRef,
            onScroll: (event) => {
              if (viewRef.current !== null) {
                viewRef.current.style.setProperty('--ds-diff-scroll', `${String(event.currentTarget.scrollLeft)}px`)
              }
            },
          },
          h('div', {
            className: 'ds-git-diff-hscroll-inner',
            style: { width: `calc(50% + ${String(displayWidth)}ch + 72px)` },
          }),
        ),
      )
      return h(
        'div',
        { className: 'ds-diffview', ref: viewRef },
        split
          ? splitBody
          : h(
              React.Fragment,
              null,
              tab.diffMode !== 'unified'
                ? h('div', { className: 'ds-git-diff-note' }, t('git.diffSplitUnavailable'))
                : null,
              h('pre', { className: 'ds-git-diff-code' }, h(Highlighted, { code: text, language: 'diff' })),
            ),
      )
    }

    function GitPanel({ root, t, onOpenDiff, showToast, onFilesChanged }) {
      const [status, setStatus] = useState(null)
      const [loading, setLoading] = useState(root !== null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [message, setMessage] = useState('')
      const [branchOpen, setBranchOpen] = useState(false)
      const [branches, setBranches] = useState([])
      const [branchBusy, setBranchBusy] = useState(false)
      const [remoteAction, setRemoteAction] = useState(null)
      const [compareOpen, setCompareOpen] = useState(false)
      const [compareRefs, setCompareRefs] = useState(null)
      const [compareBase, setCompareBase] = useState('')
      const [compareData, setCompareData] = useState(null)
      const [compareLoading, setCompareLoading] = useState(false)
      const [compareError, setCompareError] = useState(null)
      const [view, setView] = useState('changes')
      const [history, setHistory] = useState(null)
      const [historyLoading, setHistoryLoading] = useState(false)
      const [historyError, setHistoryError] = useState(null)
      const [expandedCommit, setExpandedCommit] = useState(null)
      const [commitDetail, setCommitDetail] = useState(null)
      const [commitDetailLoading, setCommitDetailLoading] = useState(false)
      const [commitDetailError, setCommitDetailError] = useState(null)
      const [stashOpen, setStashOpen] = useState(false)
      const [stashes, setStashes] = useState([])
      const [stashLoading, setStashLoading] = useState(false)
      const [stashBusy, setStashBusy] = useState(false)
      const [stashError, setStashError] = useState(null)
      const [stashMessage, setStashMessage] = useState('')
      const [stashIncludeUntracked, setStashIncludeUntracked] = useState(false)
      const [confirmState, setConfirmState] = useState(null)

      async function loadHistory(silent = false) {
        if (root === null) {
          setHistory(null)
          return
        }
        if (!silent) setHistoryLoading(true)
        setHistoryError(null)
        try {
          setHistory(await callGit('history', { root, limit: 150 }))
        } catch (failure) {
          setHistoryError(failure)
          setHistory(null)
        } finally {
          if (!silent) setHistoryLoading(false)
        }
      }

      async function openHistory() {
        setView('graph')
        if (history === null && !historyLoading) await loadHistory()
      }

      async function toggleCommit(commit) {
        if (expandedCommit === commit.hash) {
          setExpandedCommit(null)
          setCommitDetail(null)
          setCommitDetailError(null)
          return
        }
        setExpandedCommit(commit.hash)
        setCommitDetail(null)
        setCommitDetailError(null)
        setCommitDetailLoading(true)
        try {
          setCommitDetail(await callGit('commit-detail', { root, commit: commit.hash }))
        } catch (failure) {
          setCommitDetailError(failure)
        } finally {
          setCommitDetailLoading(false)
        }
      }

      async function loadStatus(silent = false) {
        if (root === null) {
          setStatus(null)
          return
        }
        if (!silent) setLoading(true)
        setError(null)
        try {
          setStatus(await callGit('status', { root }))
        } catch (failure) {
          setError(failure)
          setStatus(null)
        } finally {
          if (!silent) setLoading(false)
        }
      }

      async function loadStashes(silent = false) {
        if (root === null) {
          setStashes([])
          return
        }
        if (!silent) setStashLoading(true)
        setStashError(null)
        try {
          const value = await callGit('stash-list', { root })
          setStashes(Array.isArray(value?.stashes) ? value.stashes : [])
        } catch (failure) {
          setStashError(failure)
          setStashes([])
        } finally {
          if (!silent) setStashLoading(false)
        }
      }

      useEffect(() => {
        setStatus(null)
        setError(null)
        setMessage('')
        setBranchOpen(false)
        setCompareOpen(false)
        setCompareData(null)
        setCompareError(null)
        setView('changes')
        setHistory(null)
        setHistoryError(null)
        setExpandedCommit(null)
        setCommitDetail(null)
        setCommitDetailError(null)
        setStashOpen(false)
        setStashes([])
        setStashLoading(false)
        setStashError(null)
        setStashBusy(false)
        setStashMessage('')
        setStashIncludeUntracked(false)
        setConfirmState(null)
        if (root !== null) void loadStatus()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [root])

      useEffect(() => {
        if (!branchOpen && !compareOpen && !stashOpen && confirmState === null) return undefined
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          if (confirmState !== null) {
            setConfirmState(null)
            return
          }
          if (stashOpen) {
            setStashOpen(false)
            return
          }
          setBranchOpen(false)
          setCompareOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [branchOpen, compareOpen, stashOpen, confirmState])

      async function perform(action) {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
          await action()
          await loadStatus(true)
          if (view === 'graph') await loadHistory(true)
        } catch (failure) {
          setError(failure)
        } finally {
          setBusy(false)
        }
      }

      function stage(entry) {
        void perform(() => callGit('stage', { root, paths: [entry.path] }))
      }

      function unstage(entry) {
        void perform(() => callGit('unstage', { root, paths: [entry.path] }))
      }

      function stageAll() {
        void perform(() => callGit('stage', { root }))
      }

      function unstageAll() {
        void perform(() => callGit('unstage', { root }))
      }

      function discardEntry(entry, staged) {
        void perform(async () => {
          await callGit('discard', { root, paths: [entry.path], staged })
          if (typeof onFilesChanged === 'function') onFilesChanged()
          showToast(t('git.discardOk'))
        })
      }

      function discardAllChanges() {
        void perform(async () => {
          await callGit('discard', { root, staged: false })
          if (typeof onFilesChanged === 'function') onFilesChanged()
          showToast(t('git.discardOk'))
        })
      }

      function requestDiscard(entry, staged) {
        if (busy) return
        const untracked = !staged && entry.untracked === true
        setConfirmState({
          title: t('git.discardTitle'),
          message: untracked
            ? t('git.discardUntrackedConfirm', { path: entry.path })
            : entry.conflict
              ? t('git.discardConflictConfirm', { path: entry.path })
              : staged
                ? t('git.discardStagedConfirm', { path: entry.path })
                : t('git.discardConfirm', { path: entry.path }),
          confirmLabel: t('git.discard'),
          danger: true,
          onConfirm: () => discardEntry(entry, staged),
        })
      }

      function requestDiscardAll() {
        if (busy) return
        const count = Array.isArray(status?.changes) ? status.changes.length : 0
        if (count === 0) return
        setConfirmState({
          title: t('git.discardTitle'),
          message: t('git.discardAllConfirm', { n: String(count) }),
          confirmLabel: t('git.discard'),
          danger: true,
          onConfirm: discardAllChanges,
        })
      }

      function openStash() {
        if (root === null) return
        setStashOpen(true)
        setStashError(null)
        setStashMessage('')
        setStashIncludeUntracked(false)
        void loadStashes()
      }

      async function runStash(action) {
        if (stashBusy) return
        setStashBusy(true)
        setStashError(null)
        try {
          await action()
        } catch (failure) {
          setStashError(failure)
        } finally {
          setStashBusy(false)
        }
      }

      function saveStash() {
        if (stashBusy) return
        void runStash(async () => {
          try {
            const value = await callGit('stash-save', {
              root,
              message: stashMessage,
              includeUntracked: stashIncludeUntracked,
            })
            if (value?.saved === false) {
              showToast(t('git.stashNoChanges'))
            } else {
              setStashMessage('')
              if (typeof onFilesChanged === 'function') onFilesChanged()
              showToast(t('git.stashOk'))
            }
          } finally {
            await loadStatus(true)
          }
          await loadStashes(true)
        })
      }

      function useStash(entry, pop) {
        if (stashBusy) return
        void runStash(async () => {
          try {
            await callGit(pop ? 'stash-pop' : 'stash-apply', { root, stash: entry.ref })
            showToast(t(pop ? 'git.stashPopOk' : 'git.stashApplyOk'))
          } finally {
            if (typeof onFilesChanged === 'function') onFilesChanged()
            await loadStatus(true)
            if (view === 'graph') await loadHistory(true)
          }
          await loadStashes(true)
        })
      }

      function dropStash(entry) {
        if (stashBusy) return
        void runStash(async () => {
          await callGit('stash-drop', { root, stash: entry.ref })
          showToast(t('git.stashDropOk'))
          await loadStashes(true)
          await loadStatus(true)
        })
      }

      function requestDropStash(entry) {
        if (stashBusy) return
        setConfirmState({
          title: t('git.stashDropTitle'),
          message: t('git.stashDropConfirm', { ref: entry.ref }),
          confirmLabel: t('git.stashDrop'),
          danger: true,
          onConfirm: () => dropStash(entry),
        })
      }

      function init() {
        void perform(async () => {
          await callGit('init', { root })
          showToast(t('git.initOk'))
        })
      }

      function commit() {
        const text = message.trim()
        if (text.length === 0) {
          setError(new SideRequestError('empty-message', t('git.commitEmpty')))
          return
        }
        void perform(async () => {
          await callGit('commit', { root, message: text })
          setMessage('')
          showToast(t('git.commitOk'))
        })
      }

      function commitAndPush() {
        const text = message.trim()
        if (text.length === 0) {
          setError(new SideRequestError('empty-message', t('git.commitEmpty')))
          return
        }
        void perform(async () => {
          await callGit('commit', { root, message: text })
          setMessage('')
          try {
            const value = await callGit('push', { root })
            showToast(
              value?.setUpstream
                ? t('git.pushSetUpstream', { upstream: String(value.upstream) })
                : t('git.commitPushOk'),
            )
          } catch (failure) {
            // The commit succeeded even when the push did not; refresh so the
            // staged list reflects what is actually left.
            await loadStatus(true)
            throw failure
          }
        })
      }

      async function runRemote(kind, action, success) {
        if (busy || remoteAction !== null) return
        setRemoteAction(kind)
        setError(null)
        try {
          const value = await action()
          showToast(success(value))
          await loadStatus(true)
        } catch (failure) {
          setError(failure)
        } finally {
          setRemoteAction(null)
        }
      }

      function fetchRemote() {
        void runRemote(
          'fetch',
          () => callGit('fetch', { root }),
          (value) => (value?.fetched > 0 ? t('git.fetchOk') : t('git.fetchNone')),
        )
      }

      function pullRemote() {
        void runRemote(
          'pull',
          async () => {
            const value = await callGit('pull', { root })
            if (typeof onFilesChanged === 'function') onFilesChanged()
            return value
          },
          () => t('git.pullOk'),
        )
      }

      function pushRemote() {
        void runRemote(
          'push',
          () => callGit('push', { root }),
          (value) =>
            value?.setUpstream
              ? t('git.pushSetUpstream', { upstream: String(value.upstream) })
              : t('git.pushOk'),
        )
      }

      function compareOptions(value) {
        const options = []
        const upstream = value?.upstream ?? status?.upstream ?? null
        if (upstream) options.push(upstream)
        for (const name of value?.local ?? []) {
          if (name !== status?.branch && !options.includes(name)) options.push(name)
        }
        for (const name of value?.remote ?? []) {
          if (!options.includes(name)) options.push(name)
        }
        if (options.length === 0 && status?.branch) options.push(status.branch)
        return options
      }

      async function loadCompare(base) {
        setCompareLoading(true)
        setCompareError(null)
        try {
          setCompareData(await callGit('compare', { root, base }))
        } catch (failure) {
          setCompareError(failure)
          setCompareData(null)
        } finally {
          setCompareLoading(false)
        }
      }

      async function openCompare() {
        setCompareOpen(true)
        setCompareRefs(null)
        setCompareData(null)
        setCompareError(null)
        setCompareLoading(true)
        try {
          const value = await callGit('refs', { root })
          setCompareRefs(value)
          const options = compareOptions(value)
          const preferred =
            typeof value?.upstream === 'string' && value.upstream.length > 0 ? value.upstream : options[0] ?? ''
          setCompareBase(preferred)
          if (preferred.length > 0) await loadCompare(preferred)
          else setCompareLoading(false)
        } catch (failure) {
          setCompareError(failure)
          setCompareLoading(false)
        }
      }

      function gitFailureText(failure) {
        const keys = {
          'auth-required': 'git.authRequired',
          'no-remote': 'git.noRemote',
          'no-upstream': 'git.noUpstream',
          'non-fast-forward': 'git.nonFastForward',
          diverged: 'git.diverged',
          detached: 'git.detachedPush',
          'no-commits': 'git.noCommits',
          network: 'git.networkError',
          conflict: 'git.conflictError',
          dirty: 'git.dirtyError',
          rejected: 'git.rejected',
          'stash-conflict': 'git.stashConflict',
          'no-stash': 'git.noStash',
          unmerged: 'git.unmerged',
        }
        const key = keys[errorCode(failure)]
        return key === undefined ? errorText(failure) : t(key)
      }

      function requestDiff(entry, staged) {
        const tag = staged
          ? t('git.diffStaged')
          : entry.untracked
            ? t('git.untracked')
            : t('git.diffWorking')
        onOpenDiff({ path: entry.path, staged, untracked: !staged && entry.untracked === true, tag })
      }

      async function openBranches() {
        setBranchOpen(true)
        setBranchBusy(true)
        setError(null)
        try {
          const value = await callGit('branches', { root })
          setBranches(Array.isArray(value?.branches) ? value.branches : [])
        } catch (failure) {
          setError(failure)
          setBranches([])
        } finally {
          setBranchBusy(false)
        }
      }

      async function checkout(name) {
        setBranchBusy(true)
        setError(null)
        try {
          await callGit('checkout', { root, branch: name })
          setBranchOpen(false)
          showToast(t('git.checkoutOk'))
          if (typeof onFilesChanged === 'function') onFilesChanged()
          await loadStatus(true)
          if (view === 'graph') await loadHistory(true)
        } catch (failure) {
          setError(failure)
        } finally {
          setBranchBusy(false)
        }
      }

      const failureCode = error === null ? '' : errorCode(error)
      const failureMessage =
        failureCode === 'git-bridge-missing' || failureCode === 'http-404'
          ? t('git.installHint')
          : error === null
            ? ''
            : gitFailureText(error)

      const errorCard =
        error === null
          ? null
          : h(
              'div',
              { className: 'ds-git-error' },
              h('span', { className: 'ds-git-error-text' }, failureMessage),
              h(
                'button',
                { type: 'button', className: 'ds-linkbtn', onClick: () => void loadStatus() },
                t('git.retry'),
              ),
            )

      const spinner = h(
        'div',
        { className: 'ds-empty' },
        h('span', { className: 'ds-spinner' }),
        t('git.loading'),
      )

      function badgeLetter(entry, staged) {
        if (entry.conflict) return '!'
        if (!staged && entry.untracked) return 'U'
        const letter = staged ? entry.indexStatus : entry.worktreeStatus
        return (typeof letter === 'string' && letter.trim().length > 0 ? letter.trim() : entry.status) || 'M'
      }

      function renderRow(entry, staged) {
        const letter = badgeLetter(entry, staged)
        return h(
          'div',
          {
            key: `${staged ? 'staged' : 'changes'}:${entry.path}`,
            className: 'ds-git-row',
            role: 'button',
            tabIndex: 0,
            title: entry.oldPath === null || entry.oldPath === undefined ? entry.path : `${entry.oldPath} → ${entry.path}`,
            onClick: () => requestDiff(entry, staged),
            onKeyDown: (event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                void requestDiff(entry, staged)
              }
            },
          },
          h(
            'span',
            {
              className: 'ds-git-badge',
              'data-status': letter,
              title: letter === '!' ? t('git.conflict') : letter === 'U' ? t('git.untracked') : letter,
            },
            letter,
          ),
          h('span', { className: 'ds-git-path' }, entry.path),
          h(
            'span',
            { className: 'ds-git-row-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-iconbtn-sm ds-git-row-action',
                title: staged ? t('git.unstage') : t('git.stage'),
                disabled: busy,
                onClick: (event) => {
                  event.stopPropagation()
                  if (staged) unstage(entry)
                  else stage(entry)
                },
              },
              staged ? h(MinusIcon) : h(PlusIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-iconbtn-sm ds-git-row-action ds-git-row-discard',
                title: entry.conflict
                  ? t('git.discardConflictHint')
                  : !staged && entry.untracked
                    ? t('git.discardUntrackedHint')
                    : t('git.discard'),
                disabled: busy,
                onClick: (event) => {
                  event.stopPropagation()
                  requestDiscard(entry, staged)
                },
              },
              !staged && entry.untracked ? h(TrashIcon) : h(RestoreIcon),
            ),
          ),
        )
      }

      const branchModal = !branchOpen
        ? null
        : h(
            'div',
            {
              className: 'ds-modal-backdrop',
              onPointerDown: (event) => {
                if (event.target === event.currentTarget) setBranchOpen(false)
              },
            },
            h(
              'div',
              { className: 'ds-modal ds-git-branch-modal', role: 'dialog', 'aria-modal': true },
              h('div', { className: 'ds-modal-title' }, t('git.switchBranch')),
              branchBusy
                ? spinner
                : branches.length === 0
                  ? h('div', { className: 'ds-git-hint' }, t('git.noBranches'))
                  : h(
                      'div',
                      { className: 'ds-git-branch-list' },
                      branches.map((name) =>
                        h(
                          'button',
                          {
                            key: name,
                            type: 'button',
                            className: 'ds-git-branch-item',
                            'data-current': status !== null && name === status.branch ? 'true' : undefined,
                            disabled: busy,
                            onClick: () => void checkout(name),
                          },
                          h(GitIcon),
                          h('span', { className: 'ds-git-branch-item-name' }, name),
                          status !== null && name === status.branch
                            ? h('span', { className: 'ds-git-branch-check' }, '✓')
                            : null,
                        ),
                      ),
                    ),
              errorCard,
              h(
                'div',
                { className: 'ds-modal-actions' },
                h('button', { type: 'button', className: 'ds-btn', onClick: () => setBranchOpen(false) }, t('git.close')),
              ),
            ),
          )

      function renderCommitItem(commit, prefix) {
        return h(
          'div',
          {
            key: `${prefix}:${commit.hash}`,
            className: 'ds-git-commit-item',
            title: `${commit.subject} — ${commit.author} · ${commit.date}`,
          },
          h('code', { className: 'ds-git-commit-hash' }, commit.short),
          h('span', { className: 'ds-git-commit-subject' }, commit.subject),
          h('span', { className: 'ds-git-commit-meta' }, `${commit.author} · ${commit.date}`),
        )
      }

      function renderCompareFile(file) {
        return h(
          'div',
          {
            key: `${file.status}:${file.path}`,
            className: 'ds-git-row ds-git-compare-file',
            role: 'button',
            tabIndex: 0,
            title: file.oldPath ? `${file.oldPath} → ${file.path}` : file.path,
            onClick: () => {
              setCompareOpen(false)
              onOpenDiff({ path: file.path, base: compareBase, tag: compareBase })
            },
            onKeyDown: (event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setCompareOpen(false)
                onOpenDiff({ path: file.path, base: compareBase, tag: compareBase })
              }
            },
          },
          h(
            'span',
            { className: 'ds-git-badge', 'data-status': file.status, title: file.status },
            file.status,
          ),
          h('span', { className: 'ds-git-path' }, file.path),
        )
      }

      const compareModal = !compareOpen
        ? null
        : h(
            'div',
            {
              className: 'ds-modal-backdrop',
              onPointerDown: (event) => {
                if (event.target === event.currentTarget) setCompareOpen(false)
              },
            },
            h(
              'div',
              { className: 'ds-modal ds-git-compare-modal', role: 'dialog', 'aria-modal': true },
              h(
                'div',
                { className: 'ds-git-diff-head' },
                h('span', { className: 'ds-git-diff-title' }, t('git.compareTitle')),
                h('span', { className: 'ds-spacer' }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-iconbtn ds-iconbtn-sm',
                    title: t('git.close'),
                    onClick: () => setCompareOpen(false),
                  },
                  h(CloseIcon),
                ),
              ),
              h(
                'div',
                { className: 'ds-git-compare-body' },
                h(
                  'div',
                  { className: 'ds-git-compare-controls' },
                  h('span', { className: 'ds-git-compare-label' }, t('git.compareBase')),
                  h(
                    'select',
                    {
                      className: 'ds-git-select',
                      value: compareBase,
                      disabled: compareLoading,
                      onChange: (event) => {
                        const next = event.target.value
                        setCompareBase(next)
                        void loadCompare(next)
                      },
                    },
                    (compareRefs === null
                      ? compareBase.length > 0
                        ? [compareBase]
                        : []
                      : compareOptions(compareRefs)
                    )
                      .filter((name) => typeof name === 'string' && name.length > 0)
                      .map((name) => h('option', { key: name, value: name }, name)),
                  ),
                ),
                compareLoading
                  ? h('div', { className: 'ds-empty' }, h('span', { className: 'ds-spinner' }), t('git.compareLoading'))
                  : compareError !== null
                    ? h(
                        'div',
                        { className: 'ds-git-error' },
                        h('span', { className: 'ds-git-error-text' }, gitFailureText(compareError)),
                      )
                    : compareData === null
                      ? h('div', { className: 'ds-git-hint' }, t('git.compareFailed'))
                      : h(
                          'div',
                          { className: 'ds-git-compare-result' },
                          h(
                            'div',
                            { className: 'ds-git-compare-summary' },
                            h(
                              'span',
                              { className: 'ds-git-count' },
                              t('git.ahead', { n: String(compareData.ahead?.count ?? 0) }),
                            ),
                            h(
                              'span',
                              { className: 'ds-git-count' },
                              t('git.behind', { n: String(compareData.behind?.count ?? 0) }),
                            ),
                            compareData.truncated ? h('span', { className: 'ds-git-tag' }, '…') : null,
                          ),
                          h(
                            'div',
                            { className: 'ds-git-compare-section' },
                            h(
                              'div',
                              { className: 'ds-git-section-title' },
                              `${t('git.compareOurs')} (${String(compareData.ahead?.count ?? 0)})`,
                            ),
                            (compareData.ahead?.commits ?? []).length === 0
                              ? h('div', { className: 'ds-git-hint' }, t('git.compareNoDiff'))
                              : (compareData.ahead?.commits ?? []).map((commit) => renderCommitItem(commit, 'ahead')),
                          ),
                          (compareData.behind?.count ?? 0) > 0
                            ? h(
                                'div',
                                { className: 'ds-git-compare-section' },
                                h(
                                  'div',
                                  { className: 'ds-git-section-title' },
                                  `${t('git.compareTheirs')} (${String(compareData.behind.count)})`,
                                ),
                                (compareData.behind?.commits ?? []).map((commit) =>
                                  renderCommitItem(commit, 'behind'),
                                ),
                              )
                            : null,
                          h(
                            'div',
                            { className: 'ds-git-compare-section' },
                            h(
                              'div',
                              { className: 'ds-git-section-title' },
                              `${t('git.compareFiles')} (${String((compareData.files ?? []).length)})`,
                            ),
                            (compareData.files ?? []).length === 0
                              ? h('div', { className: 'ds-git-hint' }, t('git.compareNoDiff'))
                              : (compareData.files ?? []).map((file) => renderCompareFile(file)),
                          ),
                        ),
              ),
              h(
                'div',
                { className: 'ds-modal-actions' },
                h(
                  'button',
                  { type: 'button', className: 'ds-btn', onClick: () => setCompareOpen(false) },
                  t('git.close'),
                ),
              ),
            ),
          )

      if (root === null) {
        return h('div', { className: 'ds-git' }, h('div', { className: 'ds-git-empty' }, t('git.noRoot')))
      }

      if (status === null) {
        return h(
          'div',
          { className: 'ds-git' },
          loading ? spinner : h('div', { className: 'ds-git-empty' }, errorCard ?? h('div', { className: 'ds-git-hint' }, t('git.notRepo'))),
          branchModal,
          compareModal,
        )
      }

      if (status.repo === false) {
        const notRoot = status.reason === 'not-root'
        return h(
          'div',
          { className: 'ds-git' },
          h(
            'div',
            { className: 'ds-git-empty' },
            h('div', { className: 'ds-git-empty-title' }, notRoot ? t('git.notRoot') : t('git.notRepo')),
            notRoot ? null : h('div', { className: 'ds-git-hint' }, t('git.initHint')),
            notRoot
              ? null
              : h(
                  'button',
                  { type: 'button', className: 'ds-btn', disabled: busy, onClick: init },
                  t('git.init'),
                ),
            errorCard,
          ),
          branchModal,
          compareModal,
        )
      }

      const staged = Array.isArray(status.staged) ? status.staged : []
      const changes = Array.isArray(status.changes) ? status.changes : []
      const branchLabel = status.detached ? t('git.detached') : status.branch ?? t('git.branch')
      const hasRemote = Array.isArray(status.remotes) && status.remotes.length > 0
      const remoteBusy = remoteAction !== null
      const canCommit = staged.length > 0 && message.trim().length > 0 && !busy && !remoteBusy
      const canCommitAndPush = canCommit && hasRemote
      const canFetch = hasRemote && !busy && !remoteBusy
      const canPull = hasRemote && Boolean(status.upstream) && !busy && !remoteBusy
      const canPush = hasRemote && !status.detached && !status.unborn && !busy && !remoteBusy
      const canCompare = !status.unborn && !busy && !remoteBusy
      const canStash = !status.unborn && !busy && !remoteBusy

      function toolButton(key, Component, label, title, disabled, action, count = 0) {
        return h(
          'button',
          {
            key,
            type: 'button',
            className: 'ds-git-toolbtn',
            title,
            'data-action': key,
            'data-active': remoteAction === key || (key === 'stash' && stashOpen) ? 'true' : undefined,
            disabled,
            onClick: action,
          },
          h(Component),
          h('span', { className: 'ds-git-toolbtn-label' }, label),
          count > 0 ? h('span', { className: 'ds-git-toolcount' }, String(count)) : null,
        )
      }

      const toolbar = h(
        'div',
        { className: 'ds-git-toolbar' },
        toolButton(
          'fetch',
          RefreshIcon,
          remoteAction === 'fetch' ? t('git.fetching') : t('git.fetch'),
          t('git.fetchHint'),
          !canFetch,
          fetchRemote,
        ),
        toolButton(
          'pull',
          DownloadIcon,
          remoteAction === 'pull' ? t('git.pulling') : t('git.pull'),
          t('git.pullHint'),
          !canPull,
          pullRemote,
          status.behind,
        ),
        toolButton(
          'push',
          UploadIcon,
          remoteAction === 'push' ? t('git.pushing') : t('git.push'),
          t('git.pushHint'),
          !canPush,
          pushRemote,
          status.ahead,
        ),
        toolButton('compare', CompareIcon, t('git.compare'), t('git.compareHint'), !canCompare, () => void openCompare()),
        toolButton(
          'stash',
          StashIcon,
          t('git.stash'),
          t('git.stashHint'),
          !canStash,
          openStash,
          Number(status.stashCount) || 0,
        ),
      )

      function commitDate(value) {
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
      }

      function renderHistoryDetail(commit) {
        const detail = commitDetail !== null && commitDetail.hash === commit.hash ? commitDetail : null
        const files = Array.isArray(detail?.files) ? detail.files : []
        return h(
          'div',
          { className: 'ds-git-commit-detail' },
          commitDetailLoading
            ? h('div', { className: 'ds-git-hint' }, h('span', { className: 'ds-spinner' }), t('git.loadingCommit'))
            : commitDetailError !== null
              ? h('div', { className: 'ds-git-error' }, h('span', { className: 'ds-git-error-text' }, gitFailureText(commitDetailError)))
              : detail === null
                ? h('div', { className: 'ds-git-hint' }, t('git.loadingCommit'))
                : h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      { className: 'ds-git-commit-detail-head' },
                      h('code', { className: 'ds-git-commit-detail-hash' }, detail.short),
                      h('span', { className: 'ds-git-commit-detail-subject' }, detail.subject),
                    ),
                    h(
                      'div',
                      { className: 'ds-git-commit-detail-meta' },
                      `${detail.author} · ${commitDate(detail.date)}`,
                      detail.parents.length > 1 ? ` · ${t('git.mergeCommit', { n: String(detail.parents.length) })}` : null,
                    ),
                    detail.refs.length > 0
                      ? h(
                          'div',
                          { className: 'ds-git-graph-refs' },
                          detail.refs.map((ref) => h('span', { key: ref, className: 'ds-git-tag' }, ref)),
                        )
                      : null,
                    h(
                      'div',
                      { className: 'ds-git-commit-files' },
                      files.length === 0
                        ? h('div', { className: 'ds-git-hint' }, t('git.commitNoFiles'))
                        : files.map((file) =>
                            h(
                              'button',
                              {
                                key: `${file.status}:${file.path}`,
                                type: 'button',
                                className: 'ds-git-commit-file',
                                title: file.oldPath === null ? file.path : `${file.oldPath} → ${file.path}`,
                                onClick: () =>
                                  onOpenDiff({
                                    commit: detail.hash,
                                    path: file.path,
                                    tag: detail.short,
                                  }),
                              },
                              h('span', { className: 'ds-git-file-status', 'data-status': file.status }, file.status),
                              h('span', { className: 'ds-git-commit-file-path' }, file.path),
                              file.oldPath === null ? null : h('span', { className: 'ds-git-commit-file-old' }, `← ${file.oldPath}`),
                            ),
                          ),
                    ),
                  ),
        )
      }

      function renderHistory() {
        if (historyLoading) {
          return h('div', { className: 'ds-git-history-empty' }, h('span', { className: 'ds-spinner' }), t('git.loadingHistory'))
        }
        if (historyError !== null) {
          return h(
            'div',
            { className: 'ds-git-history-empty ds-git-error' },
            h('span', { className: 'ds-git-error-text' }, gitFailureText(historyError)),
            h('button', { type: 'button', className: 'ds-btn', onClick: () => void loadHistory() }, t('git.retry')),
          )
        }
        if (history === null) return h('div', { className: 'ds-git-history-empty' }, t('git.loadingHistory'))
        if (history.empty === true) {
          return h('div', { className: 'ds-git-history-empty' }, t('git.noCommits'))
        }
        return h(
          'div',
          { className: 'ds-git-graph' },
          h(
            'div',
            { className: 'ds-git-graph-head' },
            h('span', { className: 'ds-git-section-title' }, t('git.commitGraph')),
            history.truncated === true ? h('span', { className: 'ds-git-tag' }, t('git.graphTruncated')) : null,
          ),
          (history.rows ?? []).map((row, index) => {
            if (row.type === 'graph') {
              return h('div', { key: `graph:${String(index)}`, className: 'ds-git-graph-only' }, row.graph)
            }
            const expanded = expandedCommit === row.hash
            const refs = Array.isArray(row.refs) ? row.refs : []
            return h(
              'div',
              { key: row.hash, className: 'ds-git-graph-entry' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-git-graph-row',
                  'data-active': expanded ? 'true' : undefined,
                  onClick: () => void toggleCommit(row),
                },
                h('span', { className: 'ds-git-graph-prefix' }, row.graph),
                h(
                  'span',
                  { className: 'ds-git-graph-body' },
                  h('span', { className: 'ds-git-graph-subject' }, row.subject),
                  h(
                    'span',
                    { className: 'ds-git-graph-meta' },
                    `${row.short} · ${row.author} · ${commitDate(row.date)}`,
                  ),
                  refs.length > 0
                    ? h(
                        'span',
                        { className: 'ds-git-graph-refs' },
                        refs.slice(0, 4).map((ref) => h('span', { key: ref, className: 'ds-git-tag' }, ref)),
                        refs.length > 4 ? h('span', { className: 'ds-git-tag' }, `+${String(refs.length - 4)}`) : null,
                      )
                    : null,
                ),
              ),
              expanded ? renderHistoryDetail(row) : null,
            )
          }),
        )
      }

      const stashableCount =
        staged.length +
        changes.filter((entry) => entry.untracked !== true).length +
        (stashIncludeUntracked ? changes.filter((entry) => entry.untracked === true).length : 0)
      const canStashSave = !stashBusy && stashableCount > 0

      function renderStash(entry) {
        return h(
          'div',
          { key: entry.ref, className: 'ds-git-stash-item' },
          h(
            'div',
            { className: 'ds-git-stash-main' },
            h(
              'div',
              { className: 'ds-git-stash-line' },
              h('code', { className: 'ds-git-stash-ref' }, entry.ref),
              h('span', { className: 'ds-git-stash-message', title: entry.message }, entry.message || entry.short),
            ),
            h('div', { className: 'ds-git-stash-meta' }, `${entry.short} · ${commitDate(entry.date)}`),
          ),
          h(
            'div',
            { className: 'ds-git-stash-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ds-linkbtn',
                title: t('git.stashApplyHint'),
                disabled: stashBusy,
                onClick: () => useStash(entry, false),
              },
              t('git.stashApply'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-linkbtn',
                title: t('git.stashPopHint'),
                disabled: stashBusy,
                onClick: () => useStash(entry, true),
              },
              t('git.stashPop'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-iconbtn-sm ds-git-stash-drop',
                title: t('git.stashDrop'),
                disabled: stashBusy,
                onClick: () => requestDropStash(entry),
              },
              h(TrashIcon),
            ),
          ),
        )
      }

      const stashModal = !stashOpen
        ? null
        : h(
            'div',
            {
              className: 'ds-modal-backdrop',
              onPointerDown: (event) => {
                if (event.target === event.currentTarget) setStashOpen(false)
              },
            },
            h(
              'div',
              { className: 'ds-modal ds-git-stash-modal', role: 'dialog', 'aria-modal': true },
              h(
                'div',
                { className: 'ds-git-diff-head' },
                h('span', { className: 'ds-git-diff-title' }, t('git.stashTitle')),
                h('span', { className: 'ds-git-tag' }, String(stashes.length)),
                h('span', { className: 'ds-spacer' }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-iconbtn ds-iconbtn-sm',
                    title: t('git.close'),
                    onClick: () => setStashOpen(false),
                  },
                  h(CloseIcon),
                ),
              ),
              h(
                'div',
                { className: 'ds-git-stash-body' },
                h(
                  'div',
                  { className: 'ds-git-stash-save' },
                  h('textarea', {
                    className: 'ds-git-message ds-git-stash-input',
                    rows: 2,
                    placeholder: t('git.stashMessagePlaceholder'),
                    value: stashMessage,
                    disabled: stashBusy,
                    onChange: (event) => setStashMessage(event.target.value),
                  }),
                  h(
                    'div',
                    { className: 'ds-git-stash-save-row' },
                    h(
                      'label',
                      { className: 'ds-git-stash-option' },
                      h('input', {
                        type: 'checkbox',
                        checked: stashIncludeUntracked,
                        disabled: stashBusy,
                        onChange: (event) => setStashIncludeUntracked(event.target.checked),
                      }),
                      h('span', null, t('git.stashIncludeUntracked')),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'ds-btn ds-btn-primary ds-git-stash-save-btn',
                        disabled: !canStashSave,
                        onClick: saveStash,
                      },
                      stashBusy ? t('git.stashSaving') : t('git.stashSave'),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'ds-git-hint ds-git-stash-save-hint' },
                    canStashSave ? t('git.stashSaveHint') : t('git.stashNoChanges'),
                  ),
                ),
                stashError === null
                  ? null
                  : h(
                      'div',
                      { className: 'ds-git-error' },
                      h('span', { className: 'ds-git-error-text' }, gitFailureText(stashError)),
                    ),
                h(
                  'div',
                  { className: 'ds-git-stash-listhead' },
                  h('span', { className: 'ds-git-section-title' }, `${t('git.stashTitle')} (${String(stashes.length)})`),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-linkbtn',
                      disabled: stashLoading || stashBusy,
                      onClick: () => void loadStashes(),
                    },
                    t('git.refresh'),
                  ),
                ),
                stashLoading
                  ? h(
                      'div',
                      { className: 'ds-git-stash-empty' },
                      h('span', { className: 'ds-spinner' }),
                      t('git.stashLoading'),
                    )
                  : stashes.length === 0
                    ? h('div', { className: 'ds-git-hint' }, t('git.stashEmpty'))
                    : h('div', { className: 'ds-git-stash-list' }, stashes.map((entry) => renderStash(entry))),
              ),
              h(
                'div',
                { className: 'ds-modal-actions' },
                h(
                  'button',
                  { type: 'button', className: 'ds-btn', onClick: () => setStashOpen(false) },
                  t('git.close'),
                ),
              ),
            ),
          )

      const confirmModal =
        confirmState === null
          ? null
          : h(
              'div',
              {
                className: 'ds-modal-backdrop',
                onPointerDown: (event) => {
                  if (event.target === event.currentTarget) setConfirmState(null)
                },
              },
              h(
                'div',
                { className: 'ds-modal', role: 'dialog', 'aria-modal': true },
                h('div', { className: 'ds-modal-title' }, confirmState.title),
                h('div', { className: 'ds-modal-text' }, confirmState.message),
                h(
                  'div',
                  { className: 'ds-modal-actions' },
                  h(
                    'button',
                    { type: 'button', className: 'ds-btn', onClick: () => setConfirmState(null) },
                    t('action.cancel'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: clsx('ds-btn', confirmState.danger ? 'ds-btn-danger' : 'ds-btn-primary'),
                      onClick: () => {
                        const action = confirmState.onConfirm
                        setConfirmState(null)
                        void action()
                      },
                    },
                    confirmState.confirmLabel,
                  ),
                ),
              ),
            )

      return h(
        'div',
        { className: 'ds-git' },
        h(
          'div',
          { className: 'ds-git-viewtabs', role: 'tablist' },
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              className: 'ds-git-viewtab',
              'data-active': view === 'graph' ? undefined : 'true',
              'aria-selected': view !== 'graph',
              onClick: () => setView('changes'),
            },
            t('git.changes'),
          ),
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              className: 'ds-git-viewtab',
              'data-active': view === 'graph' ? 'true' : undefined,
              'aria-selected': view === 'graph',
              onClick: () => void openHistory(),
            },
            t('git.history'),
          ),
        ),
        h(
          'div',
          { className: 'ds-git-head' },
          h(
            'button',
            {
              type: 'button',
              className: 'ds-git-branch',
              title:
                status.upstream === null || status.upstream === undefined
                  ? t('git.switchBranch')
                  : `${t('git.switchBranch')} · ${status.upstream}`,
              onClick: () => void openBranches(),
            },
            h(GitIcon),
            h('span', { className: 'ds-git-branch-name' }, branchLabel),
            h(ChevronIcon),
          ),
          status.unborn ? h('span', { className: 'ds-git-tag' }, t('git.unborn')) : null,
          status.upstream ? h('span', { className: 'ds-git-upstream', title: status.upstream }, status.upstream) : null,
          status.ahead > 0 ? h('span', { className: 'ds-git-count' }, t('git.ahead', { n: String(status.ahead) })) : null,
          status.behind > 0 ? h('span', { className: 'ds-git-count' }, t('git.behind', { n: String(status.behind) })) : null,
          status.gone ? h('span', { className: 'ds-git-count' }, t('git.gone')) : null,
          h('span', { className: 'ds-spacer' }),
          h(
            'button',
            {
              type: 'button',
              className: 'ds-iconbtn ds-iconbtn-sm',
              title: t('git.refresh'),
              disabled: busy || loading || (view === 'graph' && historyLoading),
              onClick: () => void (view === 'graph' ? loadHistory() : loadStatus()),
            },
            h(RefreshIcon),
          ),
        ),
        toolbar,
        view === 'graph'
          ? h('div', { className: 'ds-git-history' }, renderHistory())
          : h(
              React.Fragment,
              null,
              h(
          'div',
          { className: 'ds-git-commit' },
          h('textarea', {
            className: 'ds-git-message',
            rows: 3,
            placeholder: t('git.commitPlaceholder'),
            value: message,
            disabled: busy,
            onChange: (event) => setMessage(event.target.value),
            onKeyDown: (event) => {
              if (event.isComposing) return
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                commit()
              }
            },
          }),
          h(
            'div',
            { className: 'ds-git-commit-row' },
            h(
              'span',
              { className: 'ds-git-commit-hint' },
              staged.length === 0
                ? t('git.noStaged')
                : `${String(staged.length)} · ${t('git.staged')}`,
            ),
            h(
              'div',
              { className: 'ds-git-commit-actions' },
              h(
                'button',
                { type: 'button', className: 'ds-btn ds-git-commit-btn', disabled: !canCommit, onClick: commit },
                busy ? t('git.committing') : t('git.commit'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-btn ds-git-commit-btn',
                  title: hasRemote ? t('git.pushHint') : t('git.noRemote'),
                  disabled: !canCommitAndPush,
                  onClick: commitAndPush,
                },
                t('git.commitAndPush'),
              ),
            ),
          ),
        ),
        errorCard,
        h(
          'div',
          { className: 'ds-git-scroll' },
          h(
            'div',
            { className: 'ds-git-section' },
            h(
              'div',
              { className: 'ds-git-section-head' },
              h('span', { className: 'ds-git-section-title' }, `${t('git.changes')} (${String(changes.length)})`),
              changes.length > 0
                ? h(
                    'span',
                    { className: 'ds-git-section-actions' },
                    h(
                      'button',
                      { type: 'button', className: 'ds-linkbtn ds-git-discard-all', disabled: busy, onClick: requestDiscardAll },
                      t('git.discardAll'),
                    ),
                    h('button', { type: 'button', className: 'ds-linkbtn', disabled: busy, onClick: stageAll }, t('git.stageAll')),
                  )
                : null,
            ),
            changes.length === 0
              ? h('div', { className: 'ds-git-hint' }, t('git.clean'))
              : changes.map((entry) => renderRow(entry, false)),
          ),
          h(
            'div',
            { className: 'ds-git-section' },
            h(
              'div',
              { className: 'ds-git-section-head' },
              h('span', { className: 'ds-git-section-title' }, `${t('git.staged')} (${String(staged.length)})`),
              staged.length > 0
                ? h(
                    'button',
                    { type: 'button', className: 'ds-linkbtn', disabled: busy, onClick: unstageAll },
                    t('git.unstageAll'),
                  )
                : null,
            ),
            staged.length === 0
              ? h('div', { className: 'ds-git-hint' }, t('git.noStaged'))
              : staged.map((entry) => renderRow(entry, true)),
          ),
        ),
        ),
        compareModal,
        branchModal,
        stashModal,
        confirmModal,
      )
    }

    /** Start page shown by a fresh browser tab. */
    function BrowserStart({ t, onOpen, host, onHostChange, scheme, onSchemeChange }) {
      const [scan, setScan] = useState({ status: 'loading', ports: [], supported: false })
      const [scanNonce, setScanNonce] = useState(0)
      useEffect(() => {
        let alive = true
        call('ports')
          .then((value) => {
            if (!alive) return
            setScan({
              status: 'ready',
              supported: value?.supported === true,
              ports: Array.isArray(value?.ports) ? value.ports : [],
            })
          })
          .catch(() => {
            if (alive) setScan({ status: 'failed', supported: false, ports: [] })
          })
        return () => {
          alive = false
        }
      }, [scanNonce])
      const selfPort = Number(window.location.port || (window.location.protocol === 'https:' ? '443' : '80'))
      const detected = scan.ports.filter((item) => item !== null && typeof item === 'object' && Number.isInteger(item.port) && item.port !== selfPort)
      const known = new Set(detected.map((item) => item.port))
      const common = BROWSER_COMMON_PORTS.filter((port) => !known.has(port))
      const chips = (ports) =>
        ports.map((port) =>
          h(
            'button',
            {
              key: String(port),
              type: 'button',
              className: 'ds-browser-port',
              onClick: () =>
              onOpen(
                `${previewPortScheme(scheme, port)}://${normalizePreviewHost(host)}:${String(port)}`,
              ),
            },
            h('span', { className: 'ds-browser-port-num' }, `:${String(port)}`),
            h('span', { className: 'ds-browser-port-host' }, normalizePreviewHost(host)),
          ),
        )
      return h(
        'div',
        { className: 'ds-browser-start' },
        h(
          'div',
          { className: 'ds-browser-hero' },
          h('span', { className: 'ds-browser-hero-icon' }, h(GlobeIcon)),
          h(
            'div',
            null,
            h('div', { className: 'ds-browser-hero-title' }, t('browser.startTitle')),
            h('div', { className: 'ds-browser-hero-text' }, t('browser.startHint')),
          ),
        ),
        h(
          'div',
          { className: 'ds-browser-hostbar' },
          h('span', { className: 'ds-browser-host-label' }, t('browser.scheme')),
          h(
            'select',
            {
              className: 'ds-browser-scheme-select',
              value: normalizePreviewScheme(scheme),
              title: t('browser.scheme'),
              onChange: (event) => onSchemeChange(event.target.value),
            },
            h('option', { value: 'auto' }, t('browser.schemeAuto')),
            h('option', { value: 'http' }, 'http'),
            h('option', { value: 'https' }, 'https'),
          ),
          h('span', { className: 'ds-browser-host-label' }, t('browser.host')),
          h('input', {
            className: 'ds-browser-host-input',
            value: host,
            placeholder: 'localhost',
            spellCheck: false,
            'aria-label': t('browser.host'),
            onChange: (event) => onHostChange(event.target.value),
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'ds-linkbtn',
              title: t('browser.resetDefaults'),
              onClick: () => {
                onHostChange('localhost')
                onSchemeChange('auto')
              },
            },
            t('browser.resetDefaults'),
          ),
          h('span', { className: 'ds-browser-host-hint' }, t('browser.hostHint')),
        ),
        h(
          'div',
          { className: 'ds-browser-section' },
          h(
            'div',
            { className: 'ds-browser-section-head' },
            h('div', { className: 'ds-browser-section-title' }, t('browser.detected')),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-linkbtn',
                disabled: scan.status === 'loading',
                onClick: () => setScanNonce((value) => value + 1),
              },
              t('browser.rescan'),
            ),
          ),
          scan.status === 'loading'
            ? h('div', { className: 'ds-browser-muted' }, t('browser.scanning'))
            : detected.length > 0
              ? h('div', { className: 'ds-browser-ports' }, chips(detected.map((item) => item.port)))
              : h('div', { className: 'ds-browser-muted' }, scan.supported ? t('browser.noPorts') : t('browser.scanUnsupported')),
        ),
        h(
          'div',
          { className: 'ds-browser-section' },
          h('div', { className: 'ds-browser-section-title' }, t('browser.common')),
          h('div', { className: 'ds-browser-ports' }, chips(common)),
        ),
        h('div', { className: 'ds-browser-start-hint' }, t('browser.startFooter')),
      )
    }

    /** Embedded page for one browser tab, with a same-origin guard and fallbacks. */
    function BrowserPanel({ tab, t, onNavigate, onFinished, onExternal, onDismissMixed, host, onHostChange, scheme, onSchemeChange }) {
      const frameRef = useRef(null)
      const stageRef = useRef(null)
      const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
      useEffect(() => {
        const element = stageRef.current
        if (element === null) return
        const measure = () => setStageSize({ width: element.clientWidth, height: element.clientHeight })
        measure()
        if (typeof ResizeObserver === 'undefined') {
          window.addEventListener('resize', measure)
          return () => window.removeEventListener('resize', measure)
        }
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [tab.device, tab.url])
      useEffect(() => {
        if (!tab.loading || tab.url.length === 0) return
        const timer = window.setTimeout(() => onFinished(), 12000)
        return () => window.clearTimeout(timer)
      }, [tab.loading, tab.url, tab.reloadKey, onFinished])
      useEffect(() => {
        const onMessage = (event) => {
          const frame = frameRef.current
          if (frame === null || event.source !== frame.contentWindow) return
          const data = event.data
          if (data === null || typeof data !== 'object' || typeof data.url !== 'string') return
          if (data.type === 'dsh-browser-navigate') onNavigate(data.url)
          else if (data.type === 'dsh-browser-external') onExternal(data.url)
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [onNavigate, onExternal])
      if (tab.url.length === 0) return h(BrowserStart, { t, onOpen: onNavigate, host, onHostChange, scheme, onSchemeChange })
      let sameOrigin = false
      try {
        const target = new URL(tab.url)
        const current = window.location
        const loopback = (host) => host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
        sameOrigin =
          target.origin === current.origin ||
          (target.port === current.port && loopback(target.hostname) && loopback(current.hostname))
      } catch {
        sameOrigin = true
      }
      if (sameOrigin) {
        return h(
          'div',
          { className: 'ds-browser ds-browser-blocked' },
          h(
            'div',
            { className: 'ds-empty' },
            h('div', { className: 'ds-empty-title' }, t('browser.sameOrigin')),
            h('div', { className: 'ds-empty-text' }, t('browser.sameOriginHint')),
            h(
              'button',
              { type: 'button', className: 'ds-btn', onClick: onExternal },
              h(ExternalIcon),
              t('browser.openExternal'),
            ),
          ),
        )
      }
      const mixed = window.location.protocol === 'https:' && tab.url.startsWith('http://')
      const mobile = tab.device === 'mobile'
      const device = browserDeviceSize(tab)
      const availableWidth = stageSize.width > 0 ? stageSize.width : device.width
      const availableHeight = stageSize.height > 0 ? stageSize.height : device.height
      const scale = mobile
        ? Math.min(1, Math.max(0.2, (availableWidth - 24) / device.width), Math.max(0.2, (availableHeight - 24) / device.height))
        : 1
      const frame = h('iframe', {
        key: `${tab.path}:${String(tab.reloadKey)}`,
        ref: frameRef,
        className: 'ds-browser-frame',
        src: tab.proxy === true ? proxyUrl(tab.url) : tab.url,
        title: tab.name,
        sandbox:
          tab.proxy === true
            ? 'allow-scripts allow-popups allow-modals allow-downloads'
            : 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads',
        allow: 'clipboard-read; clipboard-write; fullscreen; autoplay',
        onLoad: onFinished,
      })
      return h(
        'div',
        { className: 'ds-browser' },
        h(
          'div',
          { className: mobile ? 'ds-browser-stage ds-browser-stage-mobile' : 'ds-browser-stage', ref: stageRef },
          h(
            'div',
            {
              className: mobile ? 'ds-browser-device-wrap' : 'ds-browser-device-wrap ds-browser-device-wrap-pc',
              style: mobile
                ? { width: `${String(device.width * scale)}px`, height: `${String(device.height * scale)}px` }
                : undefined,
            },
            h(
              'div',
              {
                className: mobile ? 'ds-browser-device' : 'ds-browser-device ds-browser-device-pc',
                style: mobile
                  ? {
                      width: `${String(device.width)}px`,
                      height: `${String(device.height)}px`,
                      transform: `scale(${String(scale)})`,
                    }
                  : undefined,
                'data-device': mobile ? device.label : 'PC',
              },
              frame,
            ),
          ),
        ),
        tab.loading
          ? h('div', { className: 'ds-browser-loading' }, h('span', { className: 'ds-spinner' }), h('span', null, t('hint.loadingFile')))
          : null,
        mixed && tab.mixedDismissed !== true
          ? h(
              'div',
              { className: 'ds-browser-note' },
              h('span', { className: 'ds-browser-note-text' }, t('browser.mixed')),
              h('button', { type: 'button', className: 'ds-linkbtn', onClick: onExternal }, t('browser.openExternal')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-browser-note-close',
                  title: t('action.cancel'),
                  onClick: onDismissMixed,
                },
                h(CloseIcon),
              ),
            )
          : null,
      )
    }

    let xtermPromise = null

    function terminalAssetUrl(name) {
      const url = new URL(TERMINAL_PATH, document.baseURI)
      url.searchParams.set('op', 'asset')
      url.searchParams.set('name', name)
      return url.href
    }

    function loadExternalScript(url) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = url
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('无法加载终端渲染器'))
        document.head.appendChild(script)
      })
    }

    function ensureXterm() {
      if (window.Terminal && window.FitAddon && window.FitAddon.FitAddon) return Promise.resolve()
      if (xtermPromise !== null) return xtermPromise
      xtermPromise = new Promise((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = terminalAssetUrl('xterm.css')
        document.head.appendChild(link)
        loadExternalScript(terminalAssetUrl('xterm.js'))
          .then(() => loadExternalScript(terminalAssetUrl('addon-fit.js')))
          .then(() => {
            if (!window.Terminal || !window.FitAddon || !window.FitAddon.FitAddon) {
              throw new Error('终端渲染器未初始化')
            }
            resolve()
          })
          .catch((error) => {
            xtermPromise = null
            reject(error)
          })
      })
      return xtermPromise
    }

    async function callTerminal(op, params = {}) {
      let response
      try {
        response = await fetch(new URL(TERMINAL_PATH, document.baseURI).href, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op, ...params }),
        })
      } catch (error) {
        throw new SideRequestError('terminal-offline', `无法连接终端服务：${errorText(error)}`)
      }
      if (!response.ok) throw new SideRequestError(`http-${String(response.status)}`, `HTTP ${String(response.status)}`)
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new SideRequestError('terminal-bad-response', '终端服务返回了无法解析的响应')
      }
      if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
        const failure = payload?.error ?? {}
        throw new SideRequestError(failure.code ?? 'terminal-error', failure.message ?? '终端操作失败')
      }
      return payload.value
    }

    /** xterm.js view attached to one Host terminal session. */
    function TerminalView({ session, t, onStatus }) {
      const hostRef = useRef(null)
      const runCommandRef = useRef(null)
      const refreshCommandsRef = useRef(null)
      const statusRef = useRef(onStatus)
      const [error, setError] = useState(null)
      const [loading, setLoading] = useState(true)
      const [exited, setExited] = useState(false)
      const [commands, setCommands] = useState([])
      const [commandsRoot, setCommandsRoot] = useState(null)
      const [command, setCommand] = useState('')
      statusRef.current = onStatus

      useEffect(() => {
        let alive = true
        let busy = false
        const refresh = async () => {
          if (!alive || busy) return
          busy = true
          try {
            const value = await callTerminal('commands', { id: session.hostId })
            if (!alive) return
            if (Array.isArray(value?.commands)) setCommands(value.commands)
            if (typeof value?.root === 'string') setCommandsRoot(value.root)
          } catch {
            /* terminal backend may not support command detection yet */
          } finally {
            busy = false
          }
        }
        refreshCommandsRef.current = () => void refresh()
        void refresh()
        const timer = window.setInterval(() => void refresh(), 4000)
        return () => {
          alive = false
          refreshCommandsRef.current = null
          window.clearInterval(timer)
        }
      }, [session.hostId])

      useEffect(() => {
        let disposed = false
        let pollTimer = null
        let observer = null
        let fallbackResize = null
        let terminal = null
        let since = 0

        function report(status, code) {
          if (typeof statusRef.current === 'function') statusRef.current(session.id, status, code)
        }

        async function start() {
          await ensureXterm()
          if (disposed || hostRef.current === null) return
          const styles = window.getComputedStyle(document.documentElement)
          const background = styles.getPropertyValue('--dsw-alias-bg-base').trim() || '#111318'
          const foreground = styles.getPropertyValue('--dsw-alias-label-primary').trim() || '#d7dae0'
          terminal = new window.Terminal({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
            lineHeight: 1.2,
            scrollback: 4000,
            theme: { background, foreground, cursor: foreground },
          })
          const fit = new window.FitAddon.FitAddon()
          terminal.loadAddon(fit)
          terminal.open(hostRef.current)
          terminal.focus()
          try {
            fit.fit()
          } catch {
            /* container not measured yet */
          }
          let inputLine = ''
          const sendInput = (data) => {
            void callTerminal('write', { id: session.hostId, data }).catch(() => {})
          }
          const runLine = (line) => {
            const text = String(line ?? '').trim()
            if (text.length === 0 || disposed) return
            if (session.pty !== false) {
              sendInput(`${text}\r`)
            } else {
              inputLine = ''
              terminal.write(`${text}\r\n`)
              sendInput(`${text}\r\n`)
            }
            terminal.focus()
            window.setTimeout(() => refreshCommandsRef.current?.(), 400)
          }
          runCommandRef.current = runLine
          terminal.onData((data) => {
            if (session.pty !== false) {
              sendInput(data)
              return
            }
            // Windows pipes provide no terminal driver, so keep a local line
            // buffer for echo/backspace and send complete lines to cmd.exe.
            if (data.includes('\u001b')) return
            for (const char of data) {
              if (char === '\r' || char === '\n') {
                terminal.write('\r\n')
                sendInput(`${inputLine}\r\n`)
                inputLine = ''
              } else if (char === '\u007f' || char === '\b') {
                if (inputLine.length > 0) {
                  inputLine = inputLine.slice(0, -1)
                  terminal.write('\b \b')
                }
              } else if (char === '\u0003') {
                terminal.write('^C\r\n')
                inputLine = ''
                sendInput('\u0003\r\n')
              } else if (char >= ' ') {
                inputLine += char
                terminal.write(char)
              }
            }
          })
          const resize = () => {
            if (disposed || terminal === null) return
            try {
              fit.fit()
              void callTerminal('resize', { id: session.hostId, cols: terminal.cols, rows: terminal.rows }).catch(() => {})
            } catch {
              /* ignore transient layout */
            }
          }
          if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(resize)
            observer.observe(hostRef.current)
          } else {
            fallbackResize = resize
            window.addEventListener('resize', resize)
          }
          setTimeout(resize, 120)
          setLoading(false)
          const poll = async () => {
            if (disposed) return
            try {
              const value = await callTerminal('poll', { id: session.hostId, since })
              if (disposed) return
              if (value.reset) terminal.reset()
              if (typeof value.data === 'string' && value.data.length > 0) terminal.write(value.data)
              since = Number.isFinite(value.next) ? value.next : since
              if (value.closed) {
                setExited(true)
                report('closed', value.exitCode)
                return
              }
              pollTimer = setTimeout(() => void poll(), 140)
            } catch (failure) {
              if (!disposed) {
                setError(errorText(failure))
                report('error')
              }
            }
          }
          void poll()
        }

        start().catch((failure) => {
          if (!disposed) {
            setError(errorText(failure))
            setLoading(false)
            report('error')
          }
        })
        return () => {
          disposed = true
          runCommandRef.current = null
          if (pollTimer !== null) clearTimeout(pollTimer)
          if (observer !== null) observer.disconnect()
          if (fallbackResize !== null) window.removeEventListener('resize', fallbackResize)
          if (terminal !== null) terminal.dispose()
        }
      }, [session.id, session.hostId])

      return h(
        'div',
        { className: 'ds-terminal-view' },
        h(
          'div',
          { className: 'ds-terminal-quick', title: commandsRoot ?? session.root ?? '' },
          commands.length > 0
            ? h(
                'select',
                {
                  className: 'ds-terminal-command-select',
                  title: t('terminal.quick'),
                  value: '',
                  onChange: (event) => {
                    if (event.target.value.length > 0) setCommand(event.target.value)
                  },
                },
                h('option', { value: '' }, t('terminal.quick')),
                commands.map((item) => h('option', { key: item.id, value: item.command }, item.label)),
              )
            : h('span', { className: 'ds-terminal-quick-empty' }, t('terminal.commandsEmpty')),
          h('input', {
            className: 'ds-terminal-command-input',
            value: command,
            placeholder: t('terminal.commandPlaceholder'),
            spellCheck: false,
            onChange: (event) => setCommand(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                runCommandRef.current?.(command)
              }
            },
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'ds-terminal-command-refresh',
              title: t('terminal.refreshCommands'),
              onClick: () => refreshCommandsRef.current?.(),
            },
            h(RefreshIcon),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'ds-terminal-command-run',
              disabled: loading || exited || command.trim().length === 0,
              onClick: () => runCommandRef.current?.(command),
            },
            t('terminal.run'),
          ),
        ),
        h('div', { ref: hostRef, className: 'ds-terminal-host' }),
        loading ? h('div', { className: 'ds-terminal-overlay' }, h('span', { className: 'ds-spinner' }), t('terminal.loading')) : null,
        error !== null ? h('div', { className: 'ds-terminal-overlay ds-terminal-error' }, error) : null,
        exited ? h('div', { className: 'ds-terminal-exited' }, t('terminal.exited')) : null,
      )
    }

    /* ------------------------------------------------------------------ *
     * Floating DeepSeek conversation
     * ------------------------------------------------------------------ */

    /** Keep an embedded Conversation occurrence on the Chat view. */
    function FixedChatConversationView(props) {
      return h(React.Fragment, null, props.renderSlot('conversation.session', { view: 'chat' }))
    }

    /**
     * Render the current Session's shared Conversation content in an embedded
     * surface. The parent slot supplies the session-maybe binding, so the standard
     * Session hooks below resolve to the conversation on screen.
     */
    function ChatConversationPanel({ sessionId, useSession, useConversation, useSessions, renderFactorySlot, t }) {
      const session = useSession((value) => value)
      const conversation = useConversation((value) => value)
      const summaryBlank = useSessions((state) =>
        sessionId === undefined ? undefined : state.byId[sessionId]?.blank,
      )
      if (session === undefined || conversation === undefined) {
        return h(
          'div',
          { className: 'ds-chat-float-empty' },
          typeof t === 'function' ? t('chat.noSession') : null,
        )
      }
      const shellPhase =
        conversation.activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running
          ? 'active'
          : session.promptAttempted
            ? 'engaging'
            : 'blank'
      const parentAvailabilityPending =
        session.subagent?.address.mode === 'continuable' && session.subagent.parentAvailable === undefined
      const settling =
        (shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true) || parentAvailabilityPending
      const hero = shellPhase === 'blank' && (session.openState === 'open' || summaryBlank === true)
      return renderFactorySlot(
        'conversation.content',
        { variant: 'embedded', phase: settling ? 'settling' : hero ? 'hero' : 'active', hero },
        { slots: { views: FixedChatConversationView } },
      )
    }

    /** Legacy right-sidebar chat page body. */
    function ChatTabBody({ renderSlot }) {
      return h('div', { className: 'ds-floating-chat' }, renderSlot(CHAT_CONTENT_SLOT, {}))
    }

    /** A readable initial rectangle for the in-panel floating conversation. */
    function defaultChatRect() {
      const width = Math.min(620, Math.max(240, window.innerWidth - 32))
      const height = Math.min(760, Math.max(260, window.innerHeight - 96))
      return {
        x: Math.max(8, window.innerWidth - width - 16),
        y: 56,
        width,
        height,
      }
    }

    /**
     * Draggable, resizable frame owned by the file workspace. Its drag state stays
     * local so moving the window does not re-render the explorer, editor or chat.
     */
    function ChatFloatFrame({
      t,
      onClose,
      onNew,
      onSwitch,
      useSessions,
      workspaceItems = [],
      root,
      activeSessionId = 'current',
      creating,
      newDisabled,
      error,
      mobile = false,
      children,
    }) {
      const [rect, setRect] = useState(defaultChatRect)
      const [collapsed, setCollapsed] = useState(false)
      useEffect(() => {
        if (mobile) setCollapsed(false)
      }, [mobile])
      const sessionSnapshot =
        (typeof useSessions === 'function' ? useSessions((snapshot) => snapshot) : null) ?? null
      const mainSessionId =
        sessionSnapshot === null
          ? undefined
          : sessionSnapshot.ids.find((id) => (sessionSnapshot.byId[id]?.retainedBy?.mainView ?? 0) > 0)
      const sessions = useMemo(() => {
        if (sessionSnapshot === null) return []
        const workspace =
          root === null || root === undefined ? undefined : workspaceItems.find((item) => item.path === root)
        const allowed =
          workspace !== undefined && Array.isArray(workspace.sessionIds)
            ? new Set(workspace.sessionIds)
            : null
        const items = sessionSnapshot.ids
          .filter((id) => id !== mainSessionId && (allowed === null || allowed.has(id)))
          .map((id) => {
            const summary = sessionSnapshot.byId[id]
            return {
              id,
              title: summary?.displayTitle || t('chat.untitled'),
              updatedAt: summary?.updatedAt ?? 0,
              origin: summary?.origin,
            }
          })
          .filter((item) => item.origin !== 'subagent')
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, 50)
        if (activeSessionId !== 'current' && !items.some((item) => item.id === activeSessionId)) {
          const summary = sessionSnapshot.byId[activeSessionId]
          items.unshift({
            id: activeSessionId,
            title: summary?.displayTitle || t('chat.untitled'),
            updatedAt: summary?.updatedAt ?? 0,
            origin: summary?.origin,
          })
        }
        return items
      }, [sessionSnapshot, workspaceItems, root, activeSessionId, t, mainSessionId])

      function beginDrag(event) {
        if (mobile || event.button !== 0) return
        event.preventDefault()
        const start = rect
        const startX = event.clientX
        const startY = event.clientY
        const move = (moveEvent) => {
          const x = Math.min(
            Math.max(0, start.x + moveEvent.clientX - startX),
            Math.max(0, window.innerWidth - 120),
          )
          const y = Math.min(
            Math.max(0, start.y + moveEvent.clientY - startY),
            Math.max(0, window.innerHeight - 40),
          )
          setRect((current) => ({ ...current, x, y }))
        }
        const finish = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
      }

      function beginResize(event) {
        if (mobile || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const start = rect
        const startX = event.clientX
        const startY = event.clientY
        const move = (moveEvent) => {
          const maxWidth = Math.max(240, window.innerWidth - start.x - 8)
          const maxHeight = Math.max(220, window.innerHeight - start.y - 8)
          const width = Math.min(maxWidth, Math.max(280, start.width + moveEvent.clientX - startX))
          const height = Math.min(maxHeight, Math.max(240, start.height + moveEvent.clientY - startY))
          setRect((current) => ({ ...current, width, height }))
        }
        const finish = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
      }

      return h(
        'div',
        {
          className: clsx(
            'ds-chat-float',
            mobile ? 'ds-chat-float-mobile' : undefined,
            collapsed ? 'ds-chat-float-collapsed' : undefined,
          ),
          role: 'dialog',
          'aria-label': t('chat.title'),
          'data-mobile': mobile ? 'true' : undefined,
          style: mobile
            ? { left: 0, top: 0, width: '100%', height: '100dvh', maxHeight: '100dvh', minWidth: 0, minHeight: 0 }
            : {
                left: `${String(rect.x)}px`,
                top: `${String(rect.y)}px`,
                width: `${String(rect.width)}px`,
                height: collapsed ? '36px' : `${String(rect.height)}px`,
              },
        },
        h(
          'div',
          { className: 'ds-chat-float-head', onPointerDown: mobile ? undefined : beginDrag },
          h('span', { className: 'ds-chat-float-icon' }, h(ChatIcon)),
          sessions.length === 0
            ? h('span', { className: 'ds-chat-float-title' }, t('chat.title'))
            : h(
                'select',
                {
                  className: 'ds-chat-float-select',
                  title: t('chat.switch'),
                  'aria-label': t('chat.switch'),
                  value: activeSessionId,
                  disabled: creating,
                  onPointerDown: (event) => event.stopPropagation(),
                  onChange: (event) => {
                    if (collapsed) setCollapsed(false)
                    onSwitch(event.target.value)
                  },
                },
                h('option', { value: 'current' }, t('chat.current')),
                sessions.map((session) =>
                  h('option', { key: session.id, value: session.id }, session.title),
                ),
              ),
          h('span', { className: 'ds-spacer' }),
          h(
            'button',
            {
              type: 'button',
              className: 'ds-iconbtn ds-iconbtn-sm ds-chat-float-new',
              title: newDisabled
                ? t('chat.createSshUnsupported')
                : creating
                  ? t('chat.creating')
                  : t('chat.new'),
              disabled: creating || newDisabled,
              onPointerDown: (event) => event.stopPropagation(),
              onClick: () => {
                if (collapsed) setCollapsed(false)
                onNew()
              },
            },
            h(PlusIcon),
          ),
          mobile
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  className: 'ds-iconbtn ds-iconbtn-sm',
                  title: collapsed ? t('chat.expand') : t('chat.collapse'),
                  'aria-expanded': !collapsed,
                  onPointerDown: (event) => event.stopPropagation(),
                  onClick: () => setCollapsed((value) => !value),
                },
                collapsed ? h(ChevronDownIcon) : h(ChevronUpIcon),
              ),
          h(
            'button',
            {
              type: 'button',
              className: 'ds-iconbtn ds-iconbtn-sm ds-chat-float-close',
              title: t('chat.close'),
              onPointerDown: (event) => event.stopPropagation(),
              onClick: onClose,
            },
            h(CloseIcon),
          ),
        ),
        error === null || collapsed
          ? null
          : h('div', { className: 'ds-chat-float-error', role: 'alert' }, error),
        h(
          'div',
          { className: 'ds-chat-float-body', hidden: collapsed },
          children,
        ),
        collapsed || mobile
          ? null
          : h('div', {
              className: 'ds-chat-float-resize',
              title: t('chat.resize'),
              onPointerDown: beginResize,
            }),
      )
    }

    /* ------------------------------------------------------------------ *
     * Page
     * ------------------------------------------------------------------ */

    function makeIdePage(ctx, t, store) {
      return function IdePage(props) {
        const state = useStore(store)
        const [isMobileBrowser] = useState(() => detectMobileBrowser())
        const inSidebarTab = typeof props?.useTabInfo === 'function'
        const inlineChatSlot = inSidebarTab ? CHAT_SIDEBAR_INLINE_SLOT : CHAT_INLINE_SLOT
        const workspaceSnapshot =
          typeof props?.useWorkspaces === 'function'
            ? props.useWorkspaces((snapshot) => snapshot.items)
            : EMPTY_WORKSPACES
        const workspaceItems = Array.isArray(workspaceSnapshot) ? workspaceSnapshot : EMPTY_WORKSPACES
        const sessionsSnapshot =
          typeof props?.useSessions === 'function' ? props.useSessions((snapshot) => snapshot) : null
        const [draft, setDraft] = useState(null)
        const [menu, setMenu] = useState(null)
        const [modal, setModal] = useState(null)
        const [toast, setToast] = useState(null)
        const [banner, setBanner] = useState(null)
        const [chatOpen, setChatOpen] = useState(false)
        const [chatSession, setChatSession] = useState(null)
        const [chatCreating, setChatCreating] = useState(false)
        const [chatError, setChatError] = useState(null)
        const chatSessionRef = useRef(null)
        const chatCreatingRef = useRef(false)
        const chatRequestRef = useRef(0)
        const mountedRef = useRef(true)
        const [cursor, setCursor] = useState({ line: 1, column: 1 })
        const [agentOpen, setAgentOpen] = useState(false)
        const [agentSending, setAgentSending] = useState(false)
        const [editorSelection, setEditorSelection] = useState(null)
        const [, setLocaleVersion] = useState(0)
        const [containerWidth, setContainerWidth] = useState(0)
        const [mdSplitRatio, setMdSplitRatio] = useState(50)
        const [compactView, setCompactView] = useState('tree')
        const [address, setAddress] = useState('')
        const [pickerOpen, setPickerOpen] = useState(false)
        const [clipboard, setClipboard] = useState(null)
        const [dropTarget, setDropTarget] = useState(null)
        const [maximized, setMaximized] = useState(false)
        const [sidePosition, setSidePosition] = useState(() => (readStorage(SIDE_POSITION_KEY) === 'right' ? 'right' : 'left'))
        const [terminals, setTerminals] = useState([])
        const [terminalPanelOpen, setTerminalPanelOpen] = useState(false)
        const [terminalPanelHeight, setTerminalPanelHeight] = useState(240)
        const [terminalPanelActive, setTerminalPanelActive] = useState(null)
        const [previewHost, setPreviewHost] = useState(() => readStorage(PREVIEW_HOST_KEY) ?? 'localhost')
        const [previewScheme, setPreviewScheme] = useState(() => normalizePreviewScheme(readStorage(PREVIEW_SCHEME_KEY)))
        const [sshOpen, setSshOpen] = useState(false)
        const [sshSpec, setSshSpec] = useState('')
        const [sshPassword, setSshPassword] = useState('')
        const [sshBusy, setSshBusy] = useState(false)
        const [sshError, setSshError] = useState(null)
        const [sshCheck, setSshCheck] = useState(null)
        const [pluginVersion, setPluginVersion] = useState(null)
        const [versionInfo, setVersionInfo] = useState(null)
        const [versionBusy, setVersionBusy] = useState(false)
        const [updateBusy, setUpdateBusy] = useState(false)
        const [searchQuery, setSearchQuery] = useState('')
        const [searchRegex, setSearchRegex] = useState(false)
        const [searchCase, setSearchCase] = useState(false)
        const [searchResults, setSearchResults] = useState(null)
        const [searchBusy, setSearchBusy] = useState(false)
        const [searchError, setSearchError] = useState(null)
        const [paletteOpen, setPaletteOpen] = useState(false)
        const [paletteMode, setPaletteMode] = useState('files')
        const [paletteQuery, setPaletteQuery] = useState('')
        const [paletteFiles, setPaletteFiles] = useState([])
        const [paletteIndex, setPaletteIndex] = useState(0)
        const [paletteBusy, setPaletteBusy] = useState(false)
        const [paletteError, setPaletteError] = useState(null)
        const [harnessInfo, setHarnessInfo] = useState(null)
        const [harnessBusy, setHarnessBusy] = useState(false)
        const [harnessError, setHarnessError] = useState(null)
        const [harnessConfig, setHarnessConfig] = useState(null)
        const [harnessConfigBusy, setHarnessConfigBusy] = useState(false)
        const [harnessCheck, setHarnessCheck] = useState(null)
        const [harnessChecking, setHarnessChecking] = useState(false)
        const [paneView, setPaneView] = useState('files')
        const [uploading, setUploading] = useState(false)
        const rootRef = useRef(null)
        const mdSplitRef = useRef(null)
        const uploadInputRef = useRef(null)
        const uploadTargetRef = useRef({ root: null, parent: '' })
        const dragPathRef = useRef(null)
        const downloadAnchorRef = useRef(null)
        const browserCounterRef = useRef(0)
        const terminalCounterRef = useRef(0)
        const paletteInputRef = useRef(null)
        const searchInputRef = useRef(null)
        const autoRefreshRef = useRef(false)
        const paletteFilesRef = useRef({ root: null, files: [], at: 0 })
        const terminalsRef = useRef([])
        terminalsRef.current = terminals

        useEffect(() => {
          let alive = true
          void (async () => {
            try {
              const value = await call('version')
              if (!alive) return
              if (typeof value?.version === 'string') setPluginVersion(value.version)
              try {
                const checked = await call('versionCheck')
                if (alive && checked !== null && typeof checked === 'object') setVersionInfo(checked)
              } catch {
                /* an update check is optional */
              }
            } catch {
              /* version display is optional */
            }
          })()
          return () => {
            alive = false
          }
        }, [])

        useEffect(() => {
          const poll = async () => {
            if (document.hidden || autoRefreshRef.current) return
            const root = store.get().root
            if (root === null || isSshRootPath(root)) return
            const paths = ['', ...Object.keys(store.get().expanded)].slice(0, 32)
            autoRefreshRef.current = true
            try {
              for (const levelPath of paths) {
                if (store.get().root !== root) return
                const level = store.get().levels[levelPath]
                if (level?.status === 'loading') continue
                let value
                try {
                  value = await call('list', { root, path: levelPath })
                } catch {
                  continue
                }
                if (store.get().root !== root) return
                const entries = Array.isArray(value?.entries) ? value.entries : []
                if (JSON.stringify(level?.entries ?? []) !== JSON.stringify(entries)) {
                  patchLevel(levelPath, { status: 'ready', error: null, code: null, entries })
                  paletteFilesRef.current = { root: null, files: [], at: 0 }
                }
              }
            } finally {
              autoRefreshRef.current = false
            }
          }
          const timer = window.setInterval(() => void poll(), 5000)
          return () => window.clearInterval(timer)
        }, [])

        useEffect(() => {
          const onKey = (event) => {
            if (!(event.metaKey || event.ctrlKey)) return
            const key = event.key.toLowerCase()
            if (key === 'p') {
              event.preventDefault()
              if (event.shiftKey) openCommandPalette()
              else void openQuickOpen()
              return
            }
            if (key === 'f' && event.shiftKey) {
              event.preventDefault()
              setPaneView('search')
              setCompactView('tree')
              window.setTimeout(() => searchInputRef.current?.focus(), 0)
            }
          }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [])

        useEffect(() => {
          if (!paletteOpen) return
          const timer = window.setTimeout(() => paletteInputRef.current?.focus(), 0)
          return () => window.clearTimeout(timer)
        }, [paletteOpen])

        useEffect(() => {
          if (paneView === 'search') {
            const timer = window.setTimeout(() => searchInputRef.current?.focus(), 0)
            return () => window.clearTimeout(timer)
          }
          if (paneView === 'harness') void loadHarness()
          return undefined
        }, [paneView])

        useEffect(() => {
          if (!maximized) return
          const onKey = (event) => {
            if (event.key === 'Escape') setMaximized(false)
          }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [maximized])

        function toggleMaximize() {
          setMaximized((value) => !value)
        }

        useEffect(() => {
          const dispose = ctx.locale.subscribe(() => setLocaleVersion((value) => value + 1))
          return dispose
        }, [])

        useEffect(() => {
          mountedRef.current = true
          return () => {
            mountedRef.current = false
            const reference = chatSessionRef.current
            chatSessionRef.current = null
            if (reference !== null) reference.release()
          }
        }, [])

        useEffect(() => {
          const onUnload = () => {
            if (typeof navigator.sendBeacon !== 'function') return
            for (const session of terminalsRef.current) {
              const payload = JSON.stringify({ op: 'close', id: session.hostId })
              navigator.sendBeacon(new URL(TERMINAL_PATH, document.baseURI).href, new Blob([payload], { type: 'application/json' }))
            }
          }
          window.addEventListener('beforeunload', onUnload)
          return () => window.removeEventListener('beforeunload', onUnload)
        }, [])

        useEffect(() => {
          const element = rootRef.current
          if (element === null) return
          const measure = () => setContainerWidth(element.clientWidth)
          measure()
          if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure)
            return () => window.removeEventListener('resize', measure)
          }
          const observer = new ResizeObserver(measure)
          observer.observe(element)
          return () => observer.disconnect()
        }, [])

        useEffect(() => {
          if (store.get().ready || store.get().loadingRoots) return
          void loadRoots()
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        useEffect(() => {
          if (toast === null) return
          const timer = window.setTimeout(() => setToast(null), 2200)
          return () => window.clearTimeout(timer)
        }, [toast])

        useEffect(() => {
          if (menu === null) return
          const dismiss = (event) => {
            if (event.target instanceof Element && event.target.closest('.ds-menu') !== null) return
            setMenu(null)
          }
          const onKey = (event) => {
            if (event.key === 'Escape') setMenu(null)
          }
          window.addEventListener('pointerdown', dismiss, true)
          window.addEventListener('keydown', onKey)
          window.addEventListener('blur', dismiss)
          return () => {
            window.removeEventListener('pointerdown', dismiss, true)
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('blur', dismiss)
          }
        }, [menu])

        useEffect(() => {
          if (modal === null) return
          const onKey = (event) => {
            if (event.key === 'Escape') setModal(null)
          }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [modal])

        useEffect(() => {
          if (!pickerOpen) return
          const dismiss = (event) => {
            if (event.target instanceof Element && event.target.closest('.ds-workspace-wrap') !== null) return
            setPickerOpen(false)
          }
          const onKey = (event) => {
            if (event.key === 'Escape') setPickerOpen(false)
          }
          window.addEventListener('pointerdown', dismiss, true)
          window.addEventListener('keydown', onKey)
          window.addEventListener('blur', dismiss)
          return () => {
            window.removeEventListener('pointerdown', dismiss, true)
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('blur', dismiss)
          }
        }, [pickerOpen])

        const activeTab = state.tabs.find((tab) => tab.path === state.active) ?? null
        const activePath = activeTab?.path ?? null
        const rootIsOpen = state.expanded[''] !== undefined
        const compact = containerWidth > 0 && containerWidth < 900
        const splitStacked = containerWidth > 0 && containerWidth < 1000
        const gitAvailable = !isSshRootPath(state.root)
        const showGit = paneView === 'git' && gitAvailable
        const showSearch = paneView === 'search'
        const showHarness = paneView === 'harness'
        const showFiles = !showGit && !showSearch && !showHarness
        const treeDisplayWidth = compact
          ? '100%'
          : `${String(containerWidth > 0 ? Math.min(state.treeWidth, Math.max(220, Math.floor(containerWidth * 0.42))) : state.treeWidth)}px`
        const showSide = !maximized && (!compact || compactView === 'tree' || activeTab === null)
        const showMain = maximized || !compact || (activeTab !== null && compactView === 'editor')
        const canCollapse = Object.keys(state.expanded).some((entry) => entry !== '')
        const rootFavorites = state.root === null ? [] : state.favorites[state.root] ?? []
        const favoritePaths = new Set(rootFavorites.map((item) => item.path))
        const selectedIsFavorite =
          state.selected !== null && state.selected !== '' && favoritePaths.has(state.selected)

        useEffect(() => {
          if (activeTab === null) setCompactView('tree')
          setEditorSelection(null)
          setAgentOpen(false)
        }, [activePath])

        function showToast(message) {
          setToast(message)
        }

        async function checkVersionNow() {
          if (versionBusy) return
          setVersionBusy(true)
          try {
            const value = await call('versionCheck', { force: true })
            if (value !== null && typeof value === 'object') {
              setVersionInfo(value)
              if (typeof value.current === 'string') setPluginVersion(value.current)
              if (value.updateAvailable === true && typeof value.latest === 'string') {
                setModal({
                  title: t('version.updateTitle', { latest: value.latest }),
                  message: t('version.updateMessage', { current: value.current, latest: value.latest }),
                  link: GITHUB_URL,
                  linkLabel: t('version.openGithub'),
                  commands: [
                    { label: t('version.localUpdate'), command: 'git pull' },
                    {
                      label: t('version.pluginInstall'),
                      command: 'dsh plugin --profile web add github:taskkill/dsh-web-filebrowser',
                    },
                  ],
                  confirmLabel: t('action.ok'),
                  onConfirm: () => setModal(null),
                  onUpdate: () => void runSelfUpdate(),
                  updateLabel: updateBusy ? t('version.updating') : t('version.updateNow'),
                })
                return
              }
              if (typeof value.error === 'string') {
                showToast(t('version.checkFailed', { message: value.error }))
                return
              }
              showToast(t('version.latest', { version: value.current }))
            }
          } catch (error) {
            showToast(t('version.checkFailed', { message: errorText(error) }))
          } finally {
            setVersionBusy(false)
          }
        }

        async function runSelfUpdate() {
          if (updateBusy) return
          setModal(null)
          setUpdateBusy(true)
          showToast(t('version.updating'))
          try {
            const value = await call('update')
            const changed = value?.changed === true
            setModal({
              title: changed ? t('version.updateDone') : t('version.updateNoChange'),
              message: changed ? t('version.updateRestart') : t('version.updateNoChangeMessage'),
              code:
                typeof value?.output === 'string' && value.output.trim().length > 0
                  ? value.output.slice(-4000)
                  : '',
              confirmLabel: t('action.ok'),
              onConfirm: () => setModal(null),
            })
          } catch (error) {
            setModal({
              title: t('version.updateFailed'),
              message: errorText(error),
              confirmLabel: t('action.ok'),
              onConfirm: () => setModal(null),
            })
          } finally {
            setUpdateBusy(false)
          }
        }

        function agentContext() {
          const tab = activeTab
          if (tab === null || !isTextMode(tab.mode)) return null
          const selection = editorSelection !== null && editorSelection.path === tab.path ? editorSelection : null
          const raw = selection === null ? tab.content : selection.text
          if (raw.trim().length === 0) return null
          const text = raw.length > 12000 ? `${raw.slice(0, 12000)}\n…（内容已截断）` : raw
          const startLine = selection === null ? 1 : tab.content.slice(0, selection.start).split('\n').length
          const endLine =
            selection === null ? tab.content.split('\n').length : tab.content.slice(0, selection.end).split('\n').length
          return { tab, selection, text, startLine, endLine }
        }

        function buildAgentPrompt(action) {
          const context = agentContext()
          if (context === null) return null
          const instructions = {
            explain: '请解释下面这段代码的作用、关键流程和潜在问题。',
            fix: '请检查下面代码中的问题，并给出具体修改；如果能给出 unified diff 更好。',
            tests: '请为下面代码编写测试。',
            file: '请解释这个文件的整体结构和关键逻辑。',
          }
          const instruction = instructions[action] ?? instructions.explain
          const range =
            context.selection === null
              ? `整个文件（第 1-${String(context.endLine)} 行）`
              : `第 ${String(context.startLine)}-${String(context.endLine)} 行`
          const language = context.tab.language?.id ?? ''
          return `${instruction}\n\n文件：\`${context.tab.path}\`\n范围：${range}\n\n\`\`\`${language}\n${context.text}\n\`\`\``
        }

        function agentSessionId() {
          if (chatSession !== null) return chatSession.sessionId
          let snapshot = sessionsSnapshot
          if (snapshot === null) {
            const sessions = ctx.get('sessions')
            snapshot = typeof sessions?.list?.getSnapshot === 'function' ? sessions.list.getSnapshot() : null
          }
          if (snapshot === null || !Array.isArray(snapshot.ids)) return null
          const main = snapshot.ids.find((id) => (snapshot.byId[id]?.retainedBy?.mainView ?? 0) > 0)
          return main ?? snapshot.ids[0] ?? null
        }

        async function sendAgentPrompt(action) {
          if (agentSending) return
          const prompt = buildAgentPrompt(action)
          if (prompt === null) {
            showToast(t('agent.emptySelection'))
            return
          }
          const sessions = ctx.get('sessions')
          const sessionId = agentSessionId()
          if (sessions === undefined || sessions === null || typeof sessions.retain !== 'function' || sessionId === null) {
            showToast(t('chat.noSession'))
            return
          }
          setAgentOpen(false)
          setAgentSending(true)
          let reference = chatSession
          let owned = false
          try {
            if (reference === null) {
              reference = sessions.retain(sessionId, { source: 'filebrowserAgent' })
              owned = true
            }
            if (reference.ready !== undefined) await reference.ready
            const session = typeof sessions.get === 'function' ? sessions.get(reference.sessionId) : undefined
            if (session === undefined || typeof session.prompt !== 'function') {
              throw new Error('当前会话不支持发送消息')
            }
            const result = await session.prompt([{ type: 'text', text: prompt }], 'queue')
            if (result?.ok === false) throw new Error(result.error?.message ?? '发送被拒绝')
            setChatOpen(true)
            showToast(t('agent.sent'))
          } catch (error) {
            showToast(t('agent.failed', { message: error instanceof Error ? error.message : String(error) }))
          } finally {
            if (owned && reference !== null) reference.release()
            setAgentSending(false)
          }
        }

        async function runSearch() {
          if (searchBusy) return
          const root = store.get().root
          const query = searchQuery.trim()
          if (root === null || query.length === 0) {
            setSearchResults(null)
            setSearchError(null)
            return
          }
          if (isSshRootPath(root)) {
            setSearchResults(null)
            setSearchError(t('search.sshUnsupported'))
            return
          }
          setSearchBusy(true)
          setSearchError(null)
          try {
            const value = await call('search', {
              root,
              query,
              regex: searchRegex,
              caseSensitive: searchCase,
              maxResults: 300,
            })
            setSearchResults(value ?? null)
          } catch (error) {
            setSearchResults(null)
            setSearchError(errorCode(error) === 'ssh-unsupported' ? t('search.sshUnsupported') : errorText(error))
          } finally {
            setSearchBusy(false)
          }
        }

        function clearSearch() {
          setSearchQuery('')
          setSearchResults(null)
          setSearchError(null)
        }

        function focusSearch() {
          setPaneView('search')
          setCompactView('tree')
          window.setTimeout(() => searchInputRef.current?.focus(), 0)
        }

        async function openQuickOpen() {
          setPaletteMode('files')
          setPaletteQuery('')
          setPaletteIndex(0)
          setPaletteError(null)
          setPaletteOpen(true)
          const root = store.get().root
          if (root === null) return
          if (
            paletteFilesRef.current.root === root &&
            paletteFilesRef.current.files.length > 0 &&
            Date.now() - paletteFilesRef.current.at < 30000
          ) {
            setPaletteFiles(paletteFilesRef.current.files)
            return
          }
          if (isSshRootPath(root)) {
            setPaletteFiles([])
            setPaletteError(t('search.sshUnsupported'))
            return
          }
          setPaletteBusy(true)
          try {
            const value = await call('files', { root })
            const files = Array.isArray(value?.files) ? value.files : []
            paletteFilesRef.current = { root, files, at: Date.now() }
            setPaletteFiles(files)
          } catch (error) {
            setPaletteError(errorText(error))
          } finally {
            setPaletteBusy(false)
          }
        }

        function openCommandPalette() {
          setPaletteMode('commands')
          setPaletteQuery('')
          setPaletteIndex(0)
          setPaletteError(null)
          setPaletteOpen(true)
        }

        function closePalette() {
          setPaletteOpen(false)
          setPaletteQuery('')
          setPaletteIndex(0)
        }

        function paletteCommands() {
          const commands = [
            { id: 'new-file', label: t('action.newFile'), run: () => startCreate('file') },
            { id: 'new-folder', label: t('action.newFolder'), run: () => startCreate('directory') },
            { id: 'search', label: t('side.search'), run: focusSearch },
            { id: 'refresh', label: t('action.refresh'), run: () => void refreshAll() },
            { id: 'terminal', label: t('terminal.open'), run: () => void openTerminal('panel') },
            { id: 'browser', label: t('browser.open'), run: () => openBrowser() },
            { id: 'harness', label: t('side.harness'), run: () => void openHarness() },
          ]
          if (gitAvailable) commands.push({ id: 'git', label: t('git.title'), run: () => setPaneView('git') })
          return commands
        }

        function runPaletteItem(item) {
          if (item === undefined) return
          closePalette()
          item.run()
        }

        async function loadHarness(force = false) {
          if (harnessBusy) return
          if (harnessInfo !== null && !force) return
          setHarnessBusy(true)
          setHarnessError(null)
          try {
            const value = await call('harness')
            setHarnessInfo(value ?? null)
          } catch (error) {
            setHarnessError(errorText(error))
          } finally {
            setHarnessBusy(false)
          }
        }

        async function openHarness() {
          setPaneView('harness')
          setCompactView('tree')
          await loadHarness()
        }

        async function openHarnessConfig(name) {
          if (harnessConfigBusy) return
          setHarnessConfigBusy(true)
          try {
            const value = await call('harnessConfig', { name })
            setHarnessConfig(value ?? null)
          } catch (error) {
            showToast(t('harness.failed', { message: errorText(error) }))
          } finally {
            setHarnessConfigBusy(false)
          }
        }

        async function runHarnessCheckNow() {
          if (harnessChecking) return
          setHarnessChecking(true)
          setHarnessCheck(null)
          try {
            const value = await call('harnessCheck')
            setHarnessCheck(value ?? { code: 1, output: '', durationMs: 0 })
          } catch (error) {
            setHarnessCheck({ code: 1, output: errorText(error), durationMs: 0 })
          } finally {
            setHarnessChecking(false)
          }
        }

        function patchLevel(levelPath, patch) {
          store.set((current) => ({
            ...current,
            levels: { ...current.levels, [levelPath]: { ...(current.levels[levelPath] ?? {}), ...patch } },
          }))
        }

        function patchTab(tabPath, patch) {
          store.set((current) => ({
            ...current,
            tabs: current.tabs.map((tab) => (tab.path === tabPath ? { ...tab, ...patch } : tab)),
          }))
        }

        function isDirectory(relative) {
          if (relative === '') return true
          const parent = dirname(relative)
          const level = store.get().levels[parent]
          return level?.entries?.some((entry) => joinPath(parent, entry.name) === relative && entry.type === 'directory') ?? false
        }

        async function loadRoots() {
          const previous = store.get()
          store.set((current) => ({ ...current, loadingRoots: true, startError: null }))
          try {
            const value = await call('roots')
            const hidden = new Set(Array.isArray(previous.hiddenRoots) ? previous.hiddenRoots : [])
            const localRoots = (Array.isArray(value?.roots) ? [...value.roots] : []).filter((entry) => !hidden.has(entry.path))
            const sshRoots = readSshRoots()
              .filter((spec) => !hidden.has(spec))
              .map((spec) => ({ path: spec, title: sshRootTitle(spec) }))
            const roots = [...localRoots, ...sshRoots.filter((entry) => !localRoots.some((local) => local.path === entry.path))]
            let root = previous.root
            if (root === null || !roots.some((entry) => entry.path === root)) {
              const saved = readStorage(ROOT_KEY)
              root = roots.some((entry) => entry.path === saved) ? saved : null
            }
            if (root === null) {
              root = value?.defaultRoot && roots.some((entry) => entry.path === value.defaultRoot) ? value.defaultRoot : roots[0]?.path ?? null
            }
            const rootInfo = roots.find((entry) => entry.path === root)
            const rootChanged = root !== previous.root
            store.set((current) => ({
              ...current,
              ready: true,
              loadingRoots: false,
              roots,
              root,
              rootTitle: rootInfo?.title ?? (root === null ? '' : basename(root)),
              startError: roots.length === 0 ? t('hint.noRoot') : null,
              ...(rootChanged || !previous.ready
                ? {
                    levels: {},
                    expanded: root === null ? {} : { '': true },
                    selected: null,
                    tabs: [],
                    active: null,
                    paneView: 'files',
                  }
                : {}),
            }))
            if (rootChanged) setCompactView('tree')
            if (root !== null) {
              writeStorage(ROOT_KEY, root)
              if (rootChanged || !previous.ready) await loadDir('', { root })
            }
          } catch (error) {
            store.set((current) => ({
              ...current,
              ready: true,
              loadingRoots: false,
              startError: t('error.roots', { message: errorText(error) }),
            }))
          }
        }

        async function loadDir(levelPath, options = {}) {
          const root = options.root ?? store.get().root
          if (root === null) return
          patchLevel(levelPath, { status: 'loading', error: null, code: null })
          try {
            const value = await call('list', { root, path: levelPath })
            if (store.get().root !== root) return
            patchLevel(levelPath, { status: 'ready', error: null, code: null, entries: Array.isArray(value?.entries) ? value.entries : [] })
          } catch (error) {
            if (store.get().root !== root) return
            patchLevel(levelPath, { status: 'error', error: t('error.list', { message: errorText(error) }), code: errorCode(error) })
          }
        }

        async function ensureExpanded(levelPath) {
          let current = levelPath
          for (let guard = 0; guard < 12; guard += 1) {
            store.set((snapshot) => ({
              ...snapshot,
              expanded: { ...snapshot.expanded, [current]: true },
            }))
            let level = store.get().levels[current]
            if (level === undefined || level.status === 'error') {
              await loadDir(current)
              level = store.get().levels[current]
            }
            if (level?.status !== 'ready') break
            const visible = (level.entries ?? []).filter(
              (entry) => store.get().showHidden || !entry.name.startsWith('.'),
            )
            if (visible.length !== 1 || visible[0].type !== 'directory') break
            current = joinPath(current, visible[0].name)
          }
        }

        async function toggleDir(levelPath) {
          const open = store.get().expanded[levelPath] !== undefined
          if (open) {
            store.set((current) => {
              const expanded = { ...current.expanded }
              delete expanded[levelPath]
              return { ...current, expanded }
            })
            return
          }
          await ensureExpanded(levelPath)
        }

        async function refreshTree() {
          if (store.get().root === null) return
          const paths = ['', ...Object.keys(store.get().expanded)]
          await Promise.all(paths.map((path) => loadDir(path)))
        }

        async function refreshAll() {
          if (store.get().root === null) return
          await refreshTree()
          showToast(t('toast.refreshed'))
        }

        function rememberRoot(root) {
          writeStorage(ROOT_KEY, root)
        }

        function applyRoot(nextRoot, nextRoots) {
          closeAllTerminalSessions()
          const roots = nextRoots ?? store.get().roots
          store.set((current) => ({
            ...current,
            roots,
            root: nextRoot,
            rootTitle: roots.find((entry) => entry.path === nextRoot)?.title ?? basename(nextRoot),
            levels: {},
            expanded: { '': true },
            selected: null,
            tabs: [],
            active: null,
            paneView: 'files',
            startError: null,
          }))
          rememberRoot(nextRoot)
          setCompactView('tree')
          setSearchResults(null)
          setSearchError(null)
          paletteFilesRef.current = { root: null, files: [], at: 0 }
          void loadDir('', { root: nextRoot })
          showToast(t('toast.rootSwitched'))
        }

        function switchRoot(nextRoot) {
          if (nextRoot === store.get().root) return
          if (store.get().tabs.some((tab) => tab.dirty)) {
            setModal({
              title: t('modal.switchRootTitle'),
              message: t('modal.switchRootMessage'),
              confirmLabel: t('action.discard'),
              danger: true,
              onConfirm: () => {
                setModal(null)
                applyRoot(nextRoot)
              },
            })
            return
          }
          applyRoot(nextRoot)
        }

        function openSshDialog(initialSpec = '') {
          setPickerOpen(false)
          setSshSpec(typeof initialSpec === 'string' ? initialSpec : '')
          setSshPassword('')
          setSshError(null)
          setSshCheck(null)
          setSshOpen(true)
        }

        function closeSshDialog() {
          setSshOpen(false)
          setSshPassword('')
        }

        function validSshSpec(spec) {
          if (!isSshRootPath(spec)) return false
          try {
            const url = new URL(spec)
            return url.protocol === 'ssh:' && url.hostname.length > 0 && decodeURIComponent(url.pathname).startsWith('/')
          } catch {
            return false
          }
        }

        async function probeSsh(spec, password = '') {
          const params = { spec }
          if (password.length > 0) params.password = password
          const value = await call('sshTest', params)
          if (value === null || typeof value !== 'object' || value.type !== 'directory') {
            throw new Error(t('ssh.notDirectory'))
          }
          return value
        }

        async function testSsh() {
          if (sshBusy) return
          const spec = sshSpec.trim()
          if (!validSshSpec(spec)) {
            setSshError(t('ssh.badSpec'))
            return
          }
          setSshBusy(true)
          setSshError(null)
          setSshCheck(null)
          try {
            const value = await probeSsh(spec, sshPassword)
            setSshCheck(value.name ?? sshRootTitle(spec))
          } catch (error) {
            setSshError(errorText(error))
          } finally {
            setSshBusy(false)
          }
        }

        function activateRootEntry(entry, roots) {
          if (entry.path === store.get().root) return
          const apply = () => applyRoot(entry.path, roots)
          if (store.get().tabs.some((tab) => tab.dirty)) {
            setModal({
              title: t('modal.switchRootTitle'),
              message: t('modal.switchRootMessage'),
              confirmLabel: t('action.discard'),
              danger: true,
              onConfirm: () => {
                setModal(null)
                apply()
              },
            })
            return
          }
          apply()
        }

        async function addSsh() {
          if (sshBusy) return
          const spec = sshSpec.trim()
          if (!validSshSpec(spec)) {
            setSshError(t('ssh.badSpec'))
            return
          }
          setSshBusy(true)
          setSshError(null)
          try {
            const value = await probeSsh(spec, sshPassword)
            const entry = { path: spec, title: sshRootTitle(spec) }
            const roots = [...store.get().roots.filter((item) => item.path !== spec), entry]
            writeSshRoots([...readSshRoots(), spec])
            unhideRoot(spec)
            setSshCheck(value.name ?? entry.title)
            closeSshDialog()
            if (store.get().root === spec) void refreshTree()
            else activateRootEntry(entry, roots)
          } catch (error) {
            setSshError(errorText(error))
          } finally {
            setSshBusy(false)
          }
        }

        function removeSshRoot(spec) {
          writeSshRoots(readSshRoots().filter((item) => item !== spec))
          const current = store.get()
          const favorites = { ...current.favorites }
          delete favorites[spec]
          persistFavorites(favorites)
          const roots = current.roots.filter((entry) => entry.path !== spec)
          store.set((snapshot) => ({ ...snapshot, roots, favorites }))
          if (current.root === spec) {
            const fallback = roots[0]
            if (fallback !== undefined) applyRoot(fallback.path, roots)
            else {
              store.set((snapshot) => ({
                ...snapshot,
                root: null,
                rootTitle: '',
                levels: {},
                expanded: {},
                tabs: [],
                active: null,
                selected: null,
              }))
            }
          }
        }

        function workspaceItemFor(rootPath) {
          return workspaceItems.find((item) => item.path === rootPath)
        }

        function unhideRoot(rootPath) {
          const current = store.get()
          if (!Array.isArray(current.hiddenRoots) || !current.hiddenRoots.includes(rootPath)) return
          const hiddenRoots = current.hiddenRoots.filter((path) => path !== rootPath)
          store.set((snapshot) => ({ ...snapshot, hiddenRoots }))
          writeStorage(HIDDEN_ROOTS_KEY, JSON.stringify(hiddenRoots))
        }

        function jumpToWorkspaceRoot() {
          const current = store.get()
          if (current.root === null) {
            setBanner({ kind: 'error', message: t('error.needRoot') })
            return
          }
          setPickerOpen(false)
          setAddress('')
          setBanner(null)
          store.set((snapshot) => ({
            ...snapshot,
            expanded: { ...snapshot.expanded, '': true },
            selected: null,
          }))
          setCompactView('tree')
          const level = store.get().levels['']
          if (level === undefined || level.status === 'error') void loadDir('')
          window.requestAnimationFrame(() => {
            const tree = rootRef.current === null ? null : rootRef.current.querySelector('.ds-tree')
            if (tree !== null) tree.scrollTop = 0
          })
        }

        function requestRemoveWorkspace(root) {
          const item = workspaceItemFor(root.path)
          setPickerOpen(false)
          const dirty = root.path === store.get().root && store.get().tabs.some((tab) => tab.dirty)
          const name = root.title || basename(root.path)
          setModal({
            title: item === undefined ? t('modal.hideRootTitle') : t('modal.deleteWorkspaceTitle'),
            message:
              item === undefined
                ? dirty
                  ? t('modal.deleteWorkspaceDirty', { name, path: root.path })
                  : t('modal.hideRootMessage', { name, path: root.path })
                : dirty
                  ? t('modal.deleteWorkspaceDirty', { name, path: root.path })
                  : t('modal.deleteWorkspaceMessage', { name, path: root.path }),
            confirmLabel: t('action.remove'),
            danger: true,
            onConfirm: () => {
              setModal(null)
              void removeWorkspace(root)
            },
          })
        }

        async function removeWorkspace(root) {
          if (isSshRootPath(root.path)) {
            removeSshRoot(root.path)
            showToast(t('toast.workspaceRemoved'))
            return
          }
          const item = workspaceItemFor(root.path)
          const service = ctx.get('workspaces')
          if (item !== undefined && (service === undefined || typeof service.delete !== 'function')) {
            setBanner({ kind: 'error', message: t('error.removeWorkspaceFailed', { message: t('error.needRoot') }) })
            return
          }
          try {
            if (item !== undefined) await service.delete(item.workspaceId)
            const currentHidden = Array.isArray(store.get().hiddenRoots) ? store.get().hiddenRoots : []
            const hiddenRoots = [...new Set([...currentHidden, root.path])]
            store.set((snapshot) => ({ ...snapshot, hiddenRoots }))
            writeStorage(HIDDEN_ROOTS_KEY, JSON.stringify(hiddenRoots))
            const current = store.get()
            if (Object.prototype.hasOwnProperty.call(current.favorites, root.path)) {
              const favorites = { ...current.favorites }
              delete favorites[root.path]
              store.set((snapshot) => ({ ...snapshot, favorites }))
              persistFavorites(favorites)
            }
            await loadRoots()
            showToast(t('toast.workspaceRemoved'))
          } catch (error) {
            setBanner({ kind: 'error', message: t('error.removeWorkspaceFailed', { message: errorText(error) }) })
          }
        }

        function toggleShowHidden(next) {
          const value = next === undefined ? !store.get().showHidden : Boolean(next)
          store.set((current) => ({ ...current, showHidden: value }))
          writeStorage(HIDDEN_KEY, value ? '1' : '0')
        }

        function toggleWordWrap() {
          const next = !store.get().wordWrap
          store.set((current) => ({ ...current, wordWrap: next }))
          writeStorage(WRAP_KEY, next ? '1' : '0')
        }

        async function copyFullText(tab) {
          if (tab === null || tab === undefined || !isTextMode(tab.mode)) return
          try {
            await navigator.clipboard.writeText(tab.content)
            showToast(t('toast.copiedAll'))
          } catch {
            showToast(t('toast.copyFailed'))
          }
        }

        function pickUploads(parent) {
          const current = store.get()
          if (current.root === null) {
            setBanner({ kind: 'error', message: t('error.needRoot') })
            return
          }
          if (uploading) return
          const target = parent ?? defaultParent()
          uploadTargetRef.current = { root: current.root, parent: target }
          void ensureExpanded(target)
          const input = uploadInputRef.current
          if (input !== null) {
            input.value = ''
            input.click()
          }
        }

        async function uploadFilesTo(root, parent, files) {
          if (uploading || root === null || files.length === 0) return
          setUploading(true)
          showToast(t('toast.uploading', { count: String(files.length) }))
          let uploaded = 0
          let lastPath = null
          for (const file of files) {
            if (!isValidName(file.name)) {
              setBanner({ kind: 'error', message: t('error.badName') })
              continue
            }
            if (file.size > MAX_UPLOAD_BYTES) {
              setBanner({ kind: 'error', message: t('error.fileTooLarge', { name: file.name, size: '128 MB' }) })
              continue
            }
            if (file.name.startsWith('.') && !store.get().showHidden) toggleShowHidden(true)
            try {
              const value = await uploadToWorkspace(root, joinPath(parent, file.name), file)
              uploaded += 1
              if (value !== null && typeof value === 'object' && typeof value.path === 'string') lastPath = value.path
            } catch (error) {
              setBanner({
                kind: 'error',
                message: t('error.uploadFailed', { name: file.name, message: errorText(error) }),
              })
            }
          }
          setUploading(false)
          if (uploaded > 0) showToast(t('toast.uploaded', { count: String(uploaded) }))
          if (store.get().root === root) {
            await loadDir(parent)
            if (uploaded > 0 && lastPath !== null) {
              store.set((current) => ({ ...current, selected: lastPath }))
              if (uploaded === 1) await openFile(lastPath)
            }
          }
        }

        async function handleUploadFiles(event) {
          const input = event.target
          const files = input.files === null ? [] : Array.from(input.files)
          input.value = ''
          if (files.length === 0) return
          const target = uploadTargetRef.current
          if (target.root === null) return
          await uploadFilesTo(target.root, target.parent, files)
        }

        function targetDirectory(relative, type) {
          return type === 'directory' ? relative : dirname(relative)
        }

        function setClipItem(mode, relative, type) {
          if (relative === '') return
          setClipboard({ mode, path: relative, type })
          setMenu(null)
          showToast(
            mode === 'copy'
              ? t('toast.itemCopied', { name: basename(relative) })
              : t('toast.itemCut', { name: basename(relative) }),
          )
        }

        function canPasteInto(directory) {
          if (clipboard === null) return false
          if (clipboard.type === 'directory' && (directory === clipboard.path || directory.startsWith(clipboard.path + '/'))) {
            return false
          }
          if (clipboard.mode !== 'move') return true
          if (directory === clipboard.path) return false
          if (directory.startsWith(clipboard.path + '/')) return false
          if (dirname(clipboard.path) === directory) return false
          return true
        }

        /** Remap tabs, favorites and cached levels after a move. */
        function remapWorkspacePaths(from, to) {
          const remap = (value) => (value === from || value.startsWith(from + '/') ? to + value.slice(from.length) : value)
          store.set((current) => {
            const tabs = []
            for (const tab of current.tabs) {
              if (tab.mode === 'diff') {
                const target = tab.diff?.path
                if (typeof target === 'string' && (target === from || target.startsWith(from + '/'))) continue
                tabs.push(tab)
                continue
              }
              if (tab.path === from || tab.path.startsWith(from + '/')) {
                const next = remap(tab.path)
                tabs.push({ ...tab, path: next, name: basename(next) })
              } else {
                tabs.push(tab)
              }
            }
            const levels = {}
            for (const [key, level] of Object.entries(current.levels)) levels[remap(key)] = level
            const expanded = {}
            for (const key of Object.keys(current.expanded)) expanded[remap(key)] = true
            let active = current.active === null ? null : remap(current.active)
            if (active !== null && !tabs.some((tab) => tab.path === active)) active = tabs.at(-1)?.path ?? null
            return {
              ...current,
              tabs,
              levels,
              expanded,
              active,
              selected: current.selected === null ? null : remap(current.selected),
            }
          })
          updateFavorites((list) =>
            list.map((item) =>
              item.path === from || item.path.startsWith(from + '/')
                ? { ...item, path: remap(item.path), name: basename(remap(item.path)) }
                : item,
            ),
          )
        }

        async function moveItemTo(from, directory) {
          const root = store.get().root
          if (root === null || typeof from !== 'string' || from.length === 0) return
          if (directory === from || directory.startsWith(from + '/')) {
            setBanner({ kind: 'error', message: t('error.intoItself') })
            return
          }
          if (dirname(from) === directory) return
          try {
            const value = await call('move', { root, from, to: joinPath(directory, basename(from)) })
            remapWorkspacePaths(from, value.to)
            setClipboard((current) =>
              current !== null && (current.path === from || current.path.startsWith(from + '/')) ? null : current,
            )
            await loadDir(directory)
            await loadDir(dirname(from))
            store.set((current) => ({ ...current, selected: value.to }))
            await revealPath(value.to)
            showToast(t('toast.itemMoved', { name: basename(value.to) }))
          } catch (error) {
            setBanner({ kind: 'error', message: t('error.transferFailed', { message: errorText(error) }) })
          }
        }

        async function pasteInto(directory) {
          const root = store.get().root
          if (root === null || clipboard === null || !canPasteInto(directory)) return
          const from = clipboard.path
          const to = joinPath(directory, basename(from))
          const mode = clipboard.mode
          setMenu(null)
          try {
            if (mode === 'copy') {
              const value = await call('copy', { root, from, to, rename: true })
              await loadDir(directory)
              store.set((current) => ({ ...current, selected: value.to }))
              await revealPath(value.to)
              showToast(t('toast.itemCopied', { name: basename(value.to) }))
            } else {
              const value = await call('move', { root, from, to })
              remapWorkspacePaths(from, value.to)
              await loadDir(directory)
              await loadDir(dirname(from))
              store.set((current) => ({ ...current, selected: value.to }))
              await revealPath(value.to)
              setClipboard(null)
              showToast(t('toast.itemMoved', { name: basename(value.to) }))
            }
          } catch (error) {
            setBanner({ kind: 'error', message: t('error.transferFailed', { message: errorText(error) }) })
          }
        }

        function hasInternalDrag(event) {
          const types = event.dataTransfer?.types
          return types === undefined || types === null ? false : Array.from(types).includes(DRAG_TYPE)
        }

        function canDropOn(directory, event) {
          if (hasInternalDrag(event)) {
            const from = dragPathRef.current
            if (typeof from !== 'string' || from.length === 0) return false
            if (directory === from || directory.startsWith(from + '/')) return false
            return dirname(from) !== directory
          }
          const types = event.dataTransfer?.types
          return types !== undefined && types !== null && Array.from(types).includes('Files')
        }

        function handleTreeDragOver(event, directory) {
          const types = event.dataTransfer?.types
          const internal = hasInternalDrag(event)
          const external = types !== undefined && types !== null && Array.from(types).includes('Files')
          if (!internal && !external) return
          event.stopPropagation()
          if (!canDropOn(directory, event)) {
            if (dropTarget !== null) setDropTarget(null)
            return
          }
          event.preventDefault()
          if (event.dataTransfer !== null) {
            event.dataTransfer.dropEffect = hasInternalDrag(event) ? 'move' : 'copy'
          }
          if (dropTarget !== directory) setDropTarget(directory)
        }

        function handleTreeDragLeave(event, directory) {
          const related = event.relatedTarget
          if (related instanceof Element && event.currentTarget.contains(related)) return
          setDropTarget((current) => (current === directory ? null : current))
        }

        function handleTreeDrop(event, directory) {
          event.preventDefault()
          event.stopPropagation()
          setDropTarget(null)
          const from = event.dataTransfer?.getData(DRAG_TYPE) ?? ''
          if (from.length > 0) {
            if (directory === from || directory.startsWith(from + '/') || dirname(from) === directory) return
            void moveItemTo(from, directory)
            return
          }
          const files = event.dataTransfer?.files
          const root = store.get().root
          if (root !== null && files !== undefined && files !== null && files.length > 0) {
            void ensureExpanded(directory).then(() => uploadFilesTo(root, directory, Array.from(files)))
          }
        }

        function downloadFile(relative) {
          const root = store.get().root
          if (root === null || typeof relative !== 'string' || relative.length === 0) return
          const anchor = downloadAnchorRef.current
          if (anchor === null) return
          anchor.href = isSshRootPath(root) ? `${rawUrl(root, relative)}&download=1` : ioDownloadUrl(root, relative)
          anchor.download = basename(relative)
          anchor.target = '_blank'
          anchor.rel = 'noopener noreferrer'
          anchor.click()
        }

        function collapseAll() {
          store.set((current) => ({ ...current, expanded: current.root === null ? {} : { '': true } }))
        }

        function persistFavorites(favorites) {
          writeStorage(FAVORITES_KEY, JSON.stringify(favorites))
        }

        function updateFavorites(updater) {
          const current = store.get()
          const root = current.root
          if (root === null) return
          const list = current.favorites[root] ?? []
          const next = { ...current.favorites, [root]: updater(list) }
          store.set((snapshot) => ({ ...snapshot, favorites: next }))
          persistFavorites(next)
        }

        function toggleFavorite(relative) {
          if (relative === null || relative === '' || store.get().root === null) return
          const type = isDirectory(relative) ? 'directory' : 'file'
          updateFavorites((list) =>
            list.some((item) => item.path === relative)
              ? list.filter((item) => item.path !== relative)
              : [{ path: relative, name: basename(relative), type }, ...list],
          )
        }

        function removeFavorite(relative) {
          updateFavorites((list) => list.filter((item) => item.path !== relative))
        }

        function toggleFavoritesOpen() {
          const next = !store.get().favoritesOpen
          store.set((current) => ({ ...current, favoritesOpen: next }))
          writeStorage(FAVORITES_OPEN_KEY, next ? '1' : '0')
        }

        async function openFavorite(item) {
          await navigateRelative(item.path)
        }

        function revealPath(relative) {
          if (relative === null) return
          const escaped = relative.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
          let attempts = 0
          const attempt = () => {
            const rootElement = rootRef.current
            const row = rootElement === null ? null : rootElement.querySelector(`[data-path="${escaped}"]`)
            if (row !== null) {
              row.scrollIntoView({ block: 'nearest' })
              return
            }
            attempts += 1
            if (attempts < 4) window.requestAnimationFrame(attempt)
          }
          window.requestAnimationFrame(attempt)
        }

        async function navigateRelative(raw) {
          const root = store.get().root
          if (root === null) {
            setBanner({ kind: 'error', message: t('error.needRoot') })
            return false
          }
          const cleaned = raw.replace(/\\/g, '/').trim()
          const segments = cleaned.split('/').filter((segment) => segment.length > 0 && segment !== '.')
          let current = ''
          for (let index = 0; index < segments.length; index += 1) {
            const segment = segments[index]
            if (segment === '..') {
              current = dirname(current)
              continue
            }
            const level = store.get().levels[current]
            if (level === undefined || level.status === 'error') await loadDir(current)
            const loaded = store.get().levels[current]
            if (loaded === undefined || loaded.status === 'error') {
              setBanner({ kind: 'error', message: t('error.pathNotFound', { path: raw }) })
              return false
            }
            const entry = (loaded.entries ?? []).find((candidate) => candidate.name === segment)
            if (entry === undefined) {
              setBanner({ kind: 'error', message: t('error.pathNotFound', { path: raw }) })
              return false
            }
            current = joinPath(current, segment)
            if (entry.type === 'directory') {
              await ensureExpanded(current)
            } else if (index < segments.length - 1) {
              setBanner({ kind: 'error', message: t('error.notDirectoryPath', { path: raw }) })
              return false
            }
          }
          const hidden = segments.some((segment) => segment.startsWith('.'))
          if (hidden && !store.get().showHidden) toggleShowHidden(true)
          store.set((stateNow) => ({ ...stateNow, selected: current === '' ? null : current }))
          if (current !== '' && !isDirectory(current)) {
            await openFile(current)
          } else if (current !== '') {
            await ensureExpanded(current)
          }
          setAddress('')
          setBanner(null)
          revealPath(current === '' ? null : current)
          return true
        }

        async function goToAddress() {
          const raw = address.trim()
          if (raw.length === 0) return
          if (isSshRootPath(raw)) {
            if (!validSshSpec(raw)) {
              setBanner({ kind: 'error', message: t('ssh.badSpec') })
              return
            }
            try {
              const value = await probeSsh(raw)
              const entry = { path: raw, title: sshRootTitle(raw) }
              const roots = [...store.get().roots.filter((item) => item.path !== raw), entry]
              writeSshRoots([...readSshRoots(), raw])
              unhideRoot(raw)
              setAddress('')
              setSshCheck(value.name ?? entry.title)
              activateRootEntry(entry, roots)
            } catch (error) {
              if (errorCode(error) === 'ssh-auth') {
                setAddress('')
                setBanner(null)
                setSshSpec(raw)
                setSshPassword('')
                setSshError(null)
                setSshCheck(null)
                setPickerOpen(false)
                setSshOpen(true)
                return
              }
              setBanner({ kind: 'error', message: t('ssh.connectFailed', { message: errorText(error) }) })
            }
            return
          }
          const isAbsolute = isAbsolutePath(raw)
          const root = store.get().root
          if (!isAbsolute) {
            await navigateRelative(raw)
            return
          }
          const normalized = raw.replace(/\\/g, '/').replace(/\/+$/u, '') || '/'
          if (root !== null) {
            const prefix = root.endsWith('/') ? root : `${root}/`
            if (normalized === root || normalized.startsWith(prefix)) {
              const relative = normalized === root ? '' : normalized.slice(prefix.length)
              await navigateRelative(relative)
              return
            }
          }
          const switchTo = (entry, toRoots) => {
            unhideRoot(entry.path)
            if (entry.path === store.get().root) {
              setAddress('')
              return
            }
            const roots = toRoots.some((candidate) => candidate.path === entry.path)
              ? toRoots
              : [...toRoots, entry]
            if (store.get().tabs.some((tab) => tab.dirty)) {
              setModal({
                title: t('modal.switchRootTitle'),
                message: t('modal.switchRootMessage'),
                confirmLabel: t('action.discard'),
                danger: true,
                onConfirm: () => {
                  setModal(null)
                  applyRoot(entry.path, roots)
                  setAddress('')
                },
              })
            } else {
              applyRoot(entry.path, roots)
              setAddress('')
            }
          }
          try {
            const known = store.get().roots.find((entry) => entry.path === normalized || entry.path === raw)
            if (known !== undefined) {
              switchTo(known, store.get().roots)
              return
            }
            const workspaces = ctx.get('workspaces')
            if (workspaces === undefined || typeof workspaces.create !== 'function') {
              setBanner({ kind: 'error', message: t('error.openRootFailed', { message: t('error.needRoot') }) })
              return
            }
            const view = await workspaces.create({ path: raw })
            const entry = { path: view.path, title: view.title || basename(view.path) }
            switchTo(entry, store.get().roots)
          } catch (error) {
            await loadRoots()
            const refreshed = store.get().roots.find((entry) => entry.path === normalized || entry.path === raw)
            if (refreshed !== undefined) switchTo(refreshed, store.get().roots)
            else setBanner({ kind: 'error', message: t('error.openRootFailed', { message: errorText(error) }) })
          }
        }

        function submitAddress() {
          void goToAddress().catch((error) => {
            setBanner({ kind: 'error', message: t('error.openRootFailed', { message: errorText(error) }) })
          })
        }

        async function openFile(relative) {
          const root = store.get().root
          if (root === null) return
          setCompactView('editor')
          const existing = store.get().tabs.find((tab) => tab.path === relative)
          if (existing !== undefined) {
            store.set((current) => ({ ...current, active: relative, selected: relative }))
            setCursor({ line: 1, column: 1 })
            return
          }
          const name = basename(relative)
          const mode = modeOf(name)
          const language = languageOf(name)
          const tab = {
            path: relative,
            name,
            mode,
            language,
            content: '',
            saved: '',
            version: null,
            dirty: false,
            loading: isTextMode(mode),
            error: null,
            code: null,
            view: mode === 'markdown' ? 'preview' : 'edit',
          }
          store.set((current) => ({ ...current, tabs: [...current.tabs, tab], active: relative, selected: relative }))
          setCursor({ line: 1, column: 1 })
          if (!isTextMode(mode)) return
          try {
            const value = await call('read', { root, path: relative })
            patchTab(relative, {
              content: typeof value?.content === 'string' ? value.content : '',
              saved: typeof value?.content === 'string' ? value.content : '',
              version: typeof value?.version === 'string' ? value.version : null,
              loading: false,
              error: null,
            })
          } catch (error) {
            patchTab(relative, { loading: false, error: errorText(error), code: errorCode(error) })
          }
        }

        /** Open a file and place the editor caret at a 1-based line/column. */
        async function openFileAt(relative, line = 1, column = 1) {
          await openFile(relative)
          const tab = store.get().tabs.find((entry) => entry.path === relative)
          if (tab === undefined || !isTextMode(tab.mode)) return
          patchTab(relative, {
            ...(tab.mode === 'markdown' ? { view: 'edit' } : {}),
            reveal: {
              line: Math.max(1, Number(line) || 1),
              column: Math.max(1, Number(column) || 1),
              nonce: Date.now(),
            },
          })
        }

        function diffTabKey(request) {
          if (typeof request.commit === 'string' && request.commit.length > 0) {
            return `diff:commit:${request.commit}:${request.path}`
          }
          if (typeof request.base === 'string' && request.base.length > 0) {
            return `diff:${request.base}:${request.path}`
          }
          if (request.staged === true) return `diff:staged:${request.path}`
          if (request.untracked === true) return `diff:untracked:${request.path}`
          return `diff:working:${request.path}`
        }

        async function loadDiffInto(key, root, request) {
          patchTab(key, { loading: true, error: null, code: null })
          try {
            const value =
              typeof request.commit === 'string' && request.commit.length > 0
                ? await callGit('commit-diff', { root, commit: request.commit, path: request.path })
                : typeof request.base === 'string' && request.base.length > 0
                ? await callGit('compare-diff', { root, base: request.base, path: request.path })
                : await callGit('diff', {
                    root,
                    path: request.path,
                    staged: request.staged === true,
                    untracked: request.untracked === true,
                  })
            patchTab(key, {
              loading: false,
              error: null,
              diff: { ...request, text: typeof value?.diff === 'string' ? value.diff : '' },
            })
          } catch (error) {
            patchTab(key, { loading: false, error: errorText(error), code: errorCode(error) })
          }
        }

        /** Open one file diff as a read-only editor tab instead of a modal. */
        async function openDiffView(request) {
          const root = store.get().root
          if (root === null || request === null || typeof request !== 'object' || typeof request.path !== 'string') return
          const key = diffTabKey(request)
          setCompactView('editor')
          const existing = store.get().tabs.find((tab) => tab.path === key)
          if (existing !== undefined) {
            store.set((current) => ({ ...current, active: key, selected: request.path }))
            if (!existing.loading) await loadDiffInto(key, root, request)
            return
          }
          const tab = {
            path: key,
            name: basename(request.path),
            mode: 'diff',
            language: { id: 'diff', label: 'Diff' },
            content: '',
            saved: '',
            version: null,
            dirty: false,
            loading: true,
            error: null,
            code: null,
            view: 'edit',
            diffMode: 'split',
            diff: { ...request, text: '' },
          }
          store.set((current) => ({ ...current, tabs: [...current.tabs, tab], active: key, selected: request.path }))
          await loadDiffInto(key, root, request)
        }

        function addTerminalTab(session) {
          const key = `terminal:${session.id}`
          const existing = store.get().tabs.find((tab) => tab.path === key)
          if (existing !== undefined) {
            store.set((current) => ({ ...current, active: key }))
            return
          }
          const tab = {
            path: key,
            name: session.title,
            mode: 'terminal',
            language: { id: 'terminal', label: 'Terminal' },
            terminalId: session.id,
            content: '',
            saved: '',
            version: null,
            dirty: false,
            loading: false,
            error: null,
            code: null,
            view: 'edit',
          }
          store.set((current) => ({ ...current, tabs: [...current.tabs, tab], active: key }))
          setCompactView('editor')
        }

        function removeEditorTerminalTab(id) {
          const key = `terminal:${id}`
          const current = store.get()
          const index = current.tabs.findIndex((tab) => tab.path === key)
          if (index < 0) return
          const tabs = current.tabs.filter((tab) => tab.path !== key)
          let active = current.active
          if (active === key) active = tabs[Math.max(0, index - 1)]?.path ?? tabs[0]?.path ?? null
          store.set((snapshot) => ({ ...snapshot, tabs, active }))
        }

        function updateTerminalSession(id, patch) {
          setTerminals((current) =>
            current.map((session) => (session.id === id ? { ...session, ...patch } : session)),
          )
        }

        function closeTerminalSession(id, options = {}) {
          const session = terminals.find((entry) => entry.id === id)
          if (session !== undefined) {
            void callTerminal('close', { id: session.hostId }).catch(() => {})
          }
          const next = terminals.filter((entry) => entry.id !== id)
          setTerminals(next)
          if (options.removeEditor !== false) removeEditorTerminalTab(id)
          const remainingPanel = next.filter((entry) => entry.placement === 'panel')
          if (terminalPanelActive === id) setTerminalPanelActive(remainingPanel[0]?.id ?? null)
          if (remainingPanel.length === 0) setTerminalPanelOpen(false)
        }

        function closeAllTerminalSessions() {
          for (const session of terminals) {
            void callTerminal('close', { id: session.hostId }).catch(() => {})
          }
          setTerminals([])
          setTerminalPanelOpen(false)
          setTerminalPanelActive(null)
        }

        async function openTerminal(placement = 'panel') {
          const root = store.get().root
          if (root === null) {
            setBanner({ kind: 'error', message: t('terminal.needRoot') })
            return
          }
          if (isSshRootPath(root)) {
            setBanner({ kind: 'error', message: t('terminal.sshUnsupported') })
            return
          }
          try {
            const value = await callTerminal('open', { root, cols: 100, rows: 28 })
            if (value === null || typeof value !== 'object' || typeof value.id !== 'string') {
              throw new Error('终端服务没有返回会话 ID')
            }
            terminalCounterRef.current += 1
            const session = {
              id: value.id,
              hostId: value.id,
              title: t('terminal.title', { n: String(terminalCounterRef.current) }),
              root,
              placement,
              status: 'running',
              exitCode: null,
              pty: value.pty !== false,
            }
            setTerminals((current) => [...current, session])
            if (placement === 'panel') {
              setTerminalPanelOpen(true)
              setTerminalPanelActive(session.id)
            } else {
              addTerminalTab(session)
            }
          } catch (failure) {
            setBanner({ kind: 'error', message: t('terminal.openFailed', { message: errorText(failure) }) })
          }
        }

        function toggleTerminalPanel() {
          if (terminalPanelOpen) {
            setTerminalPanelOpen(false)
            return
          }
          if (terminals.some((session) => session.placement === 'panel')) {
            setTerminalPanelOpen(true)
            return
          }
          void openTerminal('panel')
        }

        function moveTerminalToPanel(id) {
          const session = terminals.find((entry) => entry.id === id)
          if (session === undefined) return
          removeEditorTerminalTab(id)
          setTerminals((current) =>
            current.map((entry) => (entry.id === id ? { ...entry, placement: 'panel' } : entry)),
          )
          setTerminalPanelOpen(true)
          setTerminalPanelActive(id)
        }

        function moveTerminalToEditor(id) {
          const session = terminals.find((entry) => entry.id === id)
          if (session === undefined) return
          const remainingPanel = terminals.filter((entry) => entry.placement === 'panel' && entry.id !== id)
          setTerminals((current) =>
            current.map((entry) => (entry.id === id ? { ...entry, placement: 'editor' } : entry)),
          )
          addTerminalTab({ ...session, placement: 'editor' })
          setTerminalPanelActive(remainingPanel[0]?.id ?? null)
          if (remainingPanel.length === 0) setTerminalPanelOpen(false)
        }

        function closeTerminalPanel() {
          for (const session of terminals.filter((entry) => entry.placement === 'panel')) {
            void callTerminal('close', { id: session.hostId }).catch(() => {})
          }
          setTerminals((current) => current.filter((entry) => entry.placement !== 'panel'))
          setTerminalPanelOpen(false)
          setTerminalPanelActive(null)
        }

        function startTerminalResize(event) {
          event.preventDefault()
          const startY = event.clientY
          const startHeight = terminalPanelHeight
          const onMove = (moveEvent) => {
            const next = startHeight + (startY - moveEvent.clientY)
            setTerminalPanelHeight(Math.max(120, Math.min(window.innerHeight * 0.7, next)))
          }
          const onUp = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
          }
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
        }

        function readBrowserView() {
          const fallback = { device: 'pc', preset: 'iphone14', orientation: 'portrait' }
          const raw = readStorage(BROWSER_VIEW_KEY)
          if (typeof raw !== 'string' || raw.length === 0) return fallback
          try {
            const value = JSON.parse(raw)
            return {
              device: value?.device === 'mobile' ? 'mobile' : 'pc',
              preset: Object.prototype.hasOwnProperty.call(BROWSER_DEVICES, value?.preset) ? value.preset : 'iphone14',
              orientation: value?.orientation === 'landscape' ? 'landscape' : 'portrait',
            }
          } catch {
            return fallback
          }
        }

        function setBrowserView(tab, patch) {
          const next = { ...tab, ...patch }
          patchTab(tab.path, patch)
          writeStorage(
            BROWSER_VIEW_KEY,
            JSON.stringify({ device: next.device, preset: next.mobilePreset, orientation: next.orientation }),
          )
        }

        /** Short tab title for a browser URL. */
        function browserTitle(url) {
          try {
            const parsed = new URL(url)
            const suffix = parsed.pathname === '/' || parsed.pathname === '' ? '' : parsed.pathname
            return `${parsed.host}${suffix}`.slice(0, 72)
          } catch {
            return url.slice(0, 72)
          }
        }

        /**
         * Normalize an address typed into the browser bar. Bare localhost/IP
         * hosts default to http, public hosts to https; only http(s) is allowed.
         */
        function normalizeBrowserUrl(raw, base) {
          let value = typeof raw === 'string' ? raw.trim() : ''
          if (value.length === 0) return null
          if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('?')) {
            if (typeof base !== 'string' || base.length === 0) return null
            try {
              const relative = new URL(value, base)
              return relative.protocol === 'http:' || relative.protocol === 'https:' ? relative.href : null
            } catch {
              return null
            }
          }
          if (value.startsWith('//')) value = `https:${value}`
          else if (/^https?:\/\//iu.test(value)) {
            /* already absolute */
          } else if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(value)) {
            return null
          } else if (/^:(\d{2,5})([/?#].*)?$/u.test(value)) {
            value = `http://localhost${value}`
          } else if (/^\d{2,5}([/?#].*)?$/u.test(value)) {
            value = `http://localhost:${value}`
          } else if (/^(localhost|127(?:\.\d{1,3}){3}|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\])(?::\d{1,5})?(?:[/?#]|$)/iu.test(value)) {
            value = `http://${value}`
          } else if (/^[^\s/:]+(?::\d{1,5})?(?:[/?#]|$)/u.test(value)) {
            value = `https://${value}`
          } else {
            return null
          }
          try {
            const parsed = new URL(value)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
          } catch {
            return null
          }
        }

        function openBrowser(rawUrl) {
          const normalized = typeof rawUrl === 'string' && rawUrl.trim().length > 0 ? normalizeBrowserUrl(rawUrl) : null
          if (typeof rawUrl === 'string' && rawUrl.trim().length > 0 && normalized === null) {
            setBanner({ kind: 'error', message: t('browser.badUrl') })
            return
          }
          browserCounterRef.current += 1
          const id = `browser:${String(Date.now())}:${String(browserCounterRef.current)}`
          const view = readBrowserView()
          const tab = {
            path: id,
            name: normalized === null ? t('browser.newTab') : browserTitle(normalized),
            mode: 'browser',
            language: { id: 'browser', label: 'Browser' },
            content: '',
            saved: '',
            version: null,
            dirty: false,
            loading: false,
            error: null,
            code: null,
            view: 'edit',
            url: normalized ?? '',
            input: normalized ?? '',
            proxy: false,
            device: view.device,
            mobilePreset: view.preset,
            orientation: view.orientation,
            history: normalized === null ? [] : [normalized],
            historyIndex: normalized === null ? -1 : 0,
            reloadKey: 0,
          }
          store.set((current) => ({
            ...current,
            tabs: [...current.tabs, tab],
            active: id,
          }))
          setCompactView('editor')
          setCursor({ line: 1, column: 1 })
        }

        /**
         * The floating conversation is an overlay owned by this component in both
         * placements: the main panel replaces the Conversation, and the right
         * Sidebar copy can float the same session without touching its layout.
         */
        function closeLegacyChatTabs() {
          const sidebar = ctx.get('sidebarRight')
          if (sidebar === undefined || sidebar === null) return
          try {
            const sessionId = sidebar.mounted?.getSnapshot?.()
            if (sessionId === undefined) return
            const open = sidebar.openTabs?.getSnapshot?.() ?? []
            for (const entry of open) {
              if (entry.sessionId !== sessionId || entry.kind !== CHAT_TAB_KIND) continue
              if (typeof sidebar.closeIn === 'function') sidebar.closeIn(entry.sessionId, entry.tabId)
            }
          } catch {
            /* the legacy page may already be gone */
          }
        }

        function releaseChatSession() {
          const reference = chatSessionRef.current
          chatSessionRef.current = null
          setChatSession(null)
          if (reference !== null) window.setTimeout(() => reference.release(), 0)
        }

        function closeChat() {
          chatRequestRef.current += 1
          setChatOpen(false)
          setChatError(null)
          releaseChatSession()
        }

        function toggleChat() {
          if (typeof props?.renderSlot !== 'function') {
            setBanner({ kind: 'error', message: t('chat.unavailable') })
            return
          }
          if (chatOpen) {
            closeChat()
            return
          }
          closeLegacyChatTabs()
          setChatOpen(true)
        }

        /** Create a Session without navigating away from the file workspace. */
        async function createNewChat() {
          if (chatCreatingRef.current) return
          if (typeof props?.SessionProvider !== 'function') {
            setChatError(t('chat.createUnavailable'))
            return
          }
          const sessions = ctx.get('sessions')
          if (
            sessions === undefined ||
            sessions === null ||
            typeof sessions.create !== 'function' ||
            typeof sessions.retain !== 'function'
          ) {
            setChatError(t('chat.createUnavailable'))
            return
          }
          if (state.root !== null && isSshRootPath(state.root)) {
            setChatError(t('chat.createSshUnsupported'))
            return
          }
          chatCreatingRef.current = true
          const request = (chatRequestRef.current += 1)
          setChatCreating(true)
          setChatError(null)
          try {
            const workspace =
              state.root === null ? undefined : workspaceItems.find((item) => item.path === state.root)
            const options =
              workspace?.workspaceId !== undefined
                ? { workspaceId: workspace.workspaceId }
                : state.root === null
                  ? {}
                  : { cwd: state.root }
            const sessionId = await sessions.create(options)
            if (request !== chatRequestRef.current || !mountedRef.current) return
            const reference = sessions.retain(sessionId, { source: 'filebrowserChat' })
            if (request !== chatRequestRef.current || !mountedRef.current) {
              reference.release()
              return
            }
            const previous = chatSessionRef.current
            chatSessionRef.current = reference
            setChatSession(reference)
            setChatOpen(true)
            if (previous !== null) window.setTimeout(() => previous.release(), 0)
            setChatError(null)
            showToast(t('chat.created'))
          } catch (error) {
            setChatError(t('chat.createFailed', { message: errorText(error) }))
          } finally {
            chatCreatingRef.current = false
            setChatCreating(false)
          }
        }

        function switchChat(target) {
          if (target === 'current') {
            setChatError(null)
            releaseChatSession()
            return
          }
          if (chatSession !== null && chatSession.sessionId === target) return
          const sessions = ctx.get('sessions')
          if (sessions === undefined || sessions === null || typeof sessions.retain !== 'function') {
            setChatError(t('chat.unavailable'))
            return
          }
          try {
            const reference = sessions.retain(target, { source: 'filebrowserChat' })
            const previous = chatSessionRef.current
            chatSessionRef.current = reference
            setChatSession(reference)
            setChatError(null)
            if (previous !== null) window.setTimeout(() => previous.release(), 0)
          } catch (error) {
            setChatError(t('chat.switchFailed', { message: errorText(error) }))
          }
        }

        function renderFloatingChat() {
          if (!chatOpen || typeof props?.renderSlot !== 'function') return null
          const body = h('div', { className: 'ds-floating-chat' }, props.renderSlot(inlineChatSlot, {}))
          const scoped =
            chatSession !== null && typeof props?.SessionProvider === 'function'
              ? h(props.SessionProvider, { session: chatSession }, body)
              : body
          return h(
            ChatFloatFrame,
            {
              t,
              onClose: closeChat,
              onNew: createNewChat,
              onSwitch: switchChat,
              useSessions: props?.useSessions,
              workspaceItems,
              root: state.root,
              activeSessionId: chatSession === null ? 'current' : chatSession.sessionId,
              creating: chatCreating,
              newDisabled: state.root !== null && isSshRootPath(state.root),
              error: chatError,
              mobile: isMobileBrowser,
            },
            scoped,
          )
        }

        function navigateBrowser(tabPath, rawUrl) {
          const tab = store.get().tabs.find((entry) => entry.path === tabPath)
          if (tab === undefined || tab.mode !== 'browser') return
          const normalized = normalizeBrowserUrl(rawUrl, tab.url)
          if (normalized === null) {
            setBanner({ kind: 'error', message: t('browser.badUrl') })
            return
          }
          const history = tab.history.slice(0, Math.max(0, tab.historyIndex + 1))
          history.push(normalized)
          const trimmed = history.slice(-50)
          patchTab(tabPath, {
            url: normalized,
            input: normalized,
            proxy: isDirectPreviewUrl(normalized) ? false : tab.proxy === true,
            name: browserTitle(normalized),
            history: trimmed,
            historyIndex: trimmed.length - 1,
            reloadKey: (tab.reloadKey ?? 0) + 1,
            loading: true,
          })
        }

        function browserStep(tabPath, delta) {
          const tab = store.get().tabs.find((entry) => entry.path === tabPath)
          if (tab === undefined || tab.mode !== 'browser') return
          const index = tab.historyIndex + delta
          if (index < 0 || index >= tab.history.length) return
          const url = tab.history[index]
          patchTab(tabPath, {
            url,
            input: url,
            proxy: isDirectPreviewUrl(url) ? false : tab.proxy === true,
            mixedDismissed: false,
            name: browserTitle(url),
            historyIndex: index,
            reloadKey: (tab.reloadKey ?? 0) + 1,
            loading: true,
          })
        }

        function updatePreviewHost(value) {
          setPreviewHost(value)
          writeStorage(PREVIEW_HOST_KEY, value)
        }

        function updatePreviewScheme(value) {
          const next = normalizePreviewScheme(value)
          setPreviewScheme(next)
          writeStorage(PREVIEW_SCHEME_KEY, next)
        }

        function toggleBrowserProxy(tab) {
          if (tab === undefined || tab.mode !== 'browser' || isDirectPreviewUrl(tab.url)) return
          patchTab(tab.path, {
            proxy: tab.proxy !== true,
            reloadKey: (tab.reloadKey ?? 0) + 1,
            mixedDismissed: false,
            loading: true,
          })
        }

        function reloadBrowser(tabPath) {
          const tab = store.get().tabs.find((entry) => entry.path === tabPath)
          if (tab === undefined || tab.mode !== 'browser' || tab.url.length === 0) return
          patchTab(tabPath, { reloadKey: (tab.reloadKey ?? 0) + 1, loading: true, mixedDismissed: false })
        }

        function closeNow(relative) {
          const closing = store.get().tabs.find((tab) => tab.path === relative)
          if (closing?.mode === 'terminal' && typeof closing.terminalId === 'string') {
            closeTerminalSession(closing.terminalId, { removeEditor: false })
          }
          const current = store.get()
          const index = current.tabs.findIndex((tab) => tab.path === relative)
          const tabs = current.tabs.filter((tab) => tab.path !== relative)
          let active = current.active
          if (active === relative) {
            const replacement = tabs[Math.min(index, tabs.length - 1)]
            active = replacement?.path ?? null
          }
          store.set((value) => ({ ...value, tabs, active }))
          setCursor({ line: 1, column: 1 })
          if (active === null) setCompactView('tree')
        }

        function requestClose(relative) {
          const tab = store.get().tabs.find((entry) => entry.path === relative)
          if (tab === undefined) return
          if (!tab.dirty) {
            closeNow(relative)
            return
          }
          setModal({
            title: t('modal.dirtyTitle'),
            message: t('modal.dirtyMessage', { name: tab.name }),
            confirmLabel: t('action.discard'),
            danger: true,
            onConfirm: () => {
              setModal(null)
              closeNow(relative)
            },
          })
        }

        async function saveTab(relative) {
          const current = store.get()
          const tab = current.tabs.find((entry) => entry.path === relative)
          if (tab === undefined || !isTextMode(tab.mode) || tab.loading) return
          if (current.root === null) return
          try {
            const value = await call('write', {
              root: current.root,
              path: relative,
              content: tab.content,
              expectedVersion: tab.version,
            })
            patchTab(relative, {
              version: typeof value?.version === 'string' ? value.version : tab.version,
              saved: tab.content,
              dirty: false,
            })
            setBanner(null)
            showToast(t('toast.saved'))
          } catch (error) {
            const code = errorCode(error)
            if (code === 'stale') {
              setBanner({
                kind: 'warn',
                message: t('error.stale'),
                actions: [
                  { label: t('action.reload'), run: () => { setBanner(null); void reloadTab(relative) } },
                  { label: t('action.overwrite'), run: () => { setBanner(null); void overwriteTab(relative) } },
                ],
              })
            } else {
              setBanner({ kind: 'error', message: t('error.saveFailed', { message: errorText(error) }) })
            }
          }
        }

        async function overwriteTab(relative) {
          const current = store.get()
          const tab = current.tabs.find((entry) => entry.path === relative)
          if (tab === undefined || current.root === null) return
          try {
            const value = await call('write', { root: current.root, path: relative, content: tab.content })
            patchTab(relative, {
              version: typeof value?.version === 'string' ? value.version : tab.version,
              saved: tab.content,
              dirty: false,
            })
            setBanner(null)
            showToast(t('toast.saved'))
          } catch (error) {
            setBanner({ kind: 'error', message: t('error.saveFailed', { message: errorText(error) }) })
          }
        }

        async function reloadTab(relative) {
          const current = store.get()
          if (current.root === null) return
          try {
            const value = await call('read', { root: current.root, path: relative })
            patchTab(relative, {
              content: typeof value?.content === 'string' ? value.content : '',
              saved: typeof value?.content === 'string' ? value.content : '',
              version: typeof value?.version === 'string' ? value.version : null,
              dirty: false,
              loading: false,
              error: null,
              code: null,
            })
            setBanner(null)
            showToast(t('toast.refreshed'))
          } catch (error) {
            setBanner({ kind: 'error', message: t('error.read', { message: errorText(error) }) })
          }
        }

        function requestReloadTab(relative) {
          const tab = store.get().tabs.find((entry) => entry.path === relative)
          if (tab === undefined) return
          if (!tab.dirty) {
            void reloadTab(relative)
            return
          }
          setModal({
            title: t('modal.dirtyTitle'),
            message: t('modal.dirtyMessage', { name: tab.name }),
            confirmLabel: t('action.discard'),
            danger: true,
            onConfirm: () => {
              setModal(null)
              void reloadTab(relative)
            },
          })
        }

        function renameLocal(from, to) {
          const current = store.get()
          const remap = (value) => {
            if (value === from) return to
            if (value.startsWith(`${from}/`)) return `${to}${value.slice(from.length)}`
            return value
          }
          const remapMap = (map) => {
            const next = {}
            for (const [key, value] of Object.entries(map)) next[remap(key)] = value
            return next
          }
          const favorites = { ...current.favorites }
          const root = current.root
          let favoritesChanged = false
          if (root !== null && Array.isArray(favorites[root])) {
            favorites[root] = favorites[root].map((item) => {
              const path = remap(item.path)
              if (path === item.path) return item
              favoritesChanged = true
              return { ...item, path, name: basename(path) }
            })
          }
          store.set({
            ...current,
            tabs: current.tabs.map((tab) => {
              const path = remap(tab.path)
              return path === tab.path ? tab : { ...tab, path, name: basename(path) }
            }),
            levels: remapMap(current.levels),
            expanded: remapMap(current.expanded),
            selected: current.selected === null ? null : remap(current.selected),
            active: current.active === null ? null : remap(current.active),
            favorites,
          })
          if (favoritesChanged) persistFavorites(favorites)
        }

        function defaultParent() {
          const current = store.get()
          if (current.selected !== null && current.selected !== '') {
            return isDirectory(current.selected) ? current.selected : dirname(current.selected)
          }
          if (current.active !== null) return dirname(current.active)
          return ''
        }

        function startCreate(kind, parent) {
          setMenu(null)
          const target = parent ?? defaultParent()
          void ensureExpanded(target)
          setDraft({ kind, parent: target, name: '' })
        }

        function startRename(relative) {
          if (relative === '' || relative === null) return
          setMenu(null)
          setDraft({ kind: 'rename', target: relative, parent: dirname(relative), name: basename(relative) })
        }

        async function commitDraft(value) {
          const currentDraft = draft
          const current = store.get()
          if (currentDraft === null || current.root === null) return
          const name = value.trim()
          if (name.length === 0) {
            setDraft(null)
            return
          }
          if (!isValidName(name)) {
            setBanner({ kind: 'error', message: t('error.badName') })
            return
          }
          if (name.startsWith('.') && !store.get().showHidden) toggleShowHidden(true)
          if (currentDraft.kind === 'rename' && name === basename(currentDraft.target)) {
            setDraft(null)
            return
          }
          const target = joinPath(currentDraft.parent, name)
          setDraft(null)
          try {
            if (currentDraft.kind === 'rename') {
              await call('rename', { root: current.root, from: currentDraft.target, to: target })
              renameLocal(currentDraft.target, target)
              await loadDir(dirname(currentDraft.target))
              await loadDir(dirname(target))
              if (store.get().expanded[target] !== undefined) await loadDir(target)
            } else {
              await call(currentDraft.kind === 'directory' ? 'createDir' : 'createFile', {
                root: current.root,
                path: target,
              })
              store.set((stateNow) => ({ ...stateNow, selected: target }))
              await loadDir(currentDraft.parent)
              if (currentDraft.kind === 'file') await openFile(target)
            }
            setBanner(null)
          } catch (error) {
            setBanner({
              kind: 'error',
              message: t(currentDraft.kind === 'rename' ? 'error.renameFailed' : 'error.createFailed', {
                message: errorText(error),
              }),
            })
          }
        }

        function requestDelete(relative) {
          if (relative === '') return
          const current = store.get()
          const name = basename(relative)
          const directory = isDirectory(relative)
          setMenu(null)
          setModal({
            title: t('modal.deleteTitle'),
            message: directory ? t('modal.deleteFolder', { name }) : t('modal.deleteFile', { name }),
            confirmLabel: t('modal.confirmDelete'),
            danger: true,
            onConfirm: () => {
              setModal(null)
              void deleteNow(relative, directory)
            },
          })
        }

        async function deleteNow(relative, directory) {
          const current = store.get()
          if (current.root === null) return
          try {
            await call('delete', { root: current.root, path: relative })
            let favoritesChanged = false
            store.set((stateNow) => {
              const prefix = `${relative}/`
              const removeKeys = (map) => {
                const next = {}
                for (const [key, value] of Object.entries(map)) {
                  if (key === relative || key.startsWith(prefix)) continue
                  next[key] = value
                }
                return next
              }
              const tabs = stateNow.tabs.filter((tab) => tab.path !== relative && !tab.path.startsWith(prefix))
              let active = stateNow.active
              if (active === relative || (active !== null && active.startsWith(prefix))) active = tabs[tabs.length - 1]?.path ?? null
              let selected = stateNow.selected
              if (selected === relative || (selected !== null && selected.startsWith(prefix))) selected = dirname(relative)
              const favorites = { ...stateNow.favorites }
              if (stateNow.root !== null && Array.isArray(favorites[stateNow.root])) {
                const kept = favorites[stateNow.root].filter(
                  (item) => item.path !== relative && !item.path.startsWith(prefix),
                )
                if (kept.length !== favorites[stateNow.root].length) {
                  favorites[stateNow.root] = kept
                  favoritesChanged = true
                }
              }
              return {
                ...stateNow,
                tabs,
                active,
                selected,
                levels: removeKeys(stateNow.levels),
                expanded: removeKeys(stateNow.expanded),
                favorites,
              }
            })
            if (favoritesChanged) persistFavorites(store.get().favorites)
            await loadDir(dirname(relative))
            setBanner(null)
            if (!directory) showToast(t('toast.refreshed'))
          } catch (error) {
            setBanner({ kind: 'error', message: t('error.deleteFailed', { message: errorText(error) }) })
          }
        }

        function openMenu(event, relative, type) {
          event.preventDefault()
          event.stopPropagation()
          const x = Math.min(event.clientX, Math.max(8, window.innerWidth - 220))
          const y = Math.min(event.clientY, Math.max(8, window.innerHeight - 260))
          setMenu({ x, y, path: relative, type })
          store.set((current) => ({ ...current, selected: relative }))
        }

        async function copyRelative(relative) {
          const text = relative.length === 0 ? '.' : relative
          try {
            await navigator.clipboard.writeText(text)
            showToast(t('toast.copied'))
          } catch {
            showToast(t('toast.copyFailed'))
          }
          setMenu(null)
        }

        async function copyAbsolute(relative) {
          const root = store.get().root
          if (root === null) return
          try {
            await navigator.clipboard.writeText(absolutePathOf(root, relative))
            showToast(t('toast.copied'))
          } catch {
            showToast(t('toast.copyFailed'))
          }
          setMenu(null)
        }

        function openExternal(relative) {
          const root = store.get().root
          if (root === null) return
          window.open(rawUrl(root, relative), '_blank', 'noopener,noreferrer')
          setMenu(null)
        }

        function onRootKeyDown(event) {
          if ((event.ctrlKey || event.metaKey) && event.key === '`') {
            event.preventDefault()
            toggleTerminalPanel()
            return
          }
          if (event.altKey && event.key.toLowerCase() === 'b') {
            event.preventDefault()
            openBrowser()
            return
          }
          if (event.altKey && event.key === 'Home') {
            event.preventDefault()
            jumpToWorkspaceRoot()
            return
          }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            if (activeTab !== null) {
              event.preventDefault()
              void saveTab(activeTab.path)
            }
            return
          }
          const target = event.target
          const typing =
            target instanceof HTMLElement &&
            (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
          if (typing) return
          if ((event.metaKey || event.ctrlKey) && !event.altKey) {
            const key = event.key.toLowerCase()
            if (key === 'c' && state.selected !== null && state.selected !== '') {
              event.preventDefault()
              setClipItem('copy', state.selected, isDirectory(state.selected) ? 'directory' : 'file')
              return
            }
            if (key === 'x' && state.selected !== null && state.selected !== '') {
              event.preventDefault()
              setClipItem('move', state.selected, isDirectory(state.selected) ? 'directory' : 'file')
              return
            }
            if (key === 'v') {
              const directory =
                state.selected === null || state.selected === ''
                  ? ''
                  : targetDirectory(state.selected, isDirectory(state.selected) ? 'directory' : 'file')
              if (canPasteInto(directory)) {
                event.preventDefault()
                void pasteInto(directory)
              }
              return
            }
          }
          if (event.key === 'F2' && state.selected !== null) {
            event.preventDefault()
            startRename(state.selected)
          } else if (event.key === 'Delete' && state.selected !== null) {
            event.preventDefault()
            requestDelete(state.selected)
          } else if (event.key === 'Enter' && state.selected !== null && !isDirectory(state.selected)) {
            event.preventDefault()
            void openFile(state.selected)
          }
        }

        function beginSplitDrag(event) {
          event.preventDefault()
          const startX = event.clientX
          const startWidth = store.get().treeWidth
          const move = (moveEvent) => {
            const delta = sidePosition === 'left' ? moveEvent.clientX - startX : startX - moveEvent.clientX
            const width = Math.min(560, Math.max(180, startWidth + delta))
            store.set((current) => ({ ...current, treeWidth: width }))
          }
          const finish = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', finish)
            writeStorage(WIDTH_KEY, String(store.get().treeWidth))
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', finish)
        }

        function beginMdSplitDrag(event) {
          if (splitStacked) return
          const container = mdSplitRef.current
          if (container === null) return
          event.preventDefault()
          const rect = container.getBoundingClientRect()
          if (rect.width <= 0) return
          const move = (moveEvent) => {
            const ratio = ((moveEvent.clientX - rect.left) / rect.width) * 100
            setMdSplitRatio(Math.min(80, Math.max(20, ratio)))
          }
          const finish = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', finish)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
          }
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', finish)
        }

        function renderDraftRow(levelPath, depth) {
          if (draft === null || draft.kind === 'rename' || draft.parent !== levelPath) return null
          return h(NameInput, {
            key: `draft-${levelPath}`,
            initial: '',
            depth,
            placeholder: draft.kind === 'directory' ? t('title.newFolder') : t('title.newFile'),
            onCommit: (value) => void commitDraft(value),
            onCancel: () => setDraft(null),
            t,
          })
        }

        /** VS Code compact folders: join a chain of single-child, expanded directories. */
        function compactChain(relative) {
          const chain = [relative]
          let current = relative
          for (let guard = 0; guard < 12; guard += 1) {
            if (store.get().expanded[current] === undefined) break
            const level = store.get().levels[current]
            if (level?.status !== 'ready') break
            const visible = (level.entries ?? []).filter(
              (entry) => store.get().showHidden || !entry.name.startsWith('.'),
            )
            if (visible.length !== 1 || visible[0].type !== 'directory') break
            const child = joinPath(current, visible[0].name)
            if (store.get().expanded[child] === undefined) break
            chain.push(child)
            current = child
          }
          return chain
        }

        function renderLevel(levelPath, depth) {
          const level = state.levels[levelPath]
          const nodes = []
          const draftRow = renderDraftRow(levelPath, depth)
          if (draftRow !== null) nodes.push(draftRow)
          if (level === undefined || (level.status === 'loading' && level.entries === undefined)) {
            if (draftRow === null) nodes.push(h('div', { key: `loading-${levelPath}`, className: 'ds-hint' }, t('hint.loading')))
            return nodes
          }
          if (level.status === 'error') {
            const sshAuthFailed = level.code === 'ssh-auth' && isSshRootPath(store.get().root)
            nodes.push(
              h(
                'div',
                { key: `error-${levelPath}`, className: 'ds-errorline' },
                h('span', null, level.error ?? t('error.internal', { message: '' })),
                sshAuthFailed
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'ds-linkbtn',
                        onClick: () => openSshDialog(store.get().root ?? ''),
                      },
                      t('ssh.enterPassword'),
                    )
                  : null,
                h(
                  'button',
                  { type: 'button', className: 'ds-linkbtn', onClick: () => void loadDir(levelPath) },
                  t('action.retry'),
                ),
              ),
            )
            return nodes
          }
          const allEntries = level.entries ?? []
          const entries = allEntries.filter((entry) => state.showHidden || !entry.name.startsWith('.'))
          if (entries.length === 0) {
            // VS Code-style explorer: an expanded empty folder renders no
            // placeholder row; the folder row itself is still visible above.
            return nodes
          }
          for (const entry of entries) {
            const relative = joinPath(levelPath, entry.name)
            const isDir = entry.type === 'directory'
            const chain = isDir ? compactChain(relative) : [relative]
            const leaf = chain[chain.length - 1]
            const directoryOpen = state.expanded[relative] !== undefined
            const displayName = isDir ? chain.map((value) => basename(value)).join('/') : entry.name
            if (draft !== null && draft.kind === 'rename' && draft.target === relative) {
              nodes.push(
                h(NameInput, {
                  key: `rename-${relative}`,
                  initial: draft.name,
                  depth,
                  placeholder: t('title.rename'),
                  onCommit: (value) => void commitDraft(value),
                  onCancel: () => setDraft(null),
                  t,
                }),
              )
              continue
            }
            const isSelected = state.selected === relative
            const isActive = state.active === relative
            nodes.push(
              h(
                'div',
                {
                  key: relative,
                  className: 'ds-row',
                  role: 'treeitem',
                  tabIndex: 0,
                  'data-path': relative,
                  'data-selected': isSelected ? 'true' : undefined,
                  'data-active': isActive ? 'true' : undefined,
                  'aria-selected': isSelected,
                  'aria-expanded': isDir ? directoryOpen : undefined,
                  'data-cut': clipboard?.mode === 'move' && clipboard.path === relative ? 'true' : undefined,
                  'data-drop': isDir && dropTarget === relative ? 'true' : undefined,
                  draggable: true,
                  style: { paddingLeft: `${String(8 + depth * 14)}px` },
                  title: isDir ? chain.join('/') : relative,
                  onDragStart: (event) => {
                    event.stopPropagation()
                    dragPathRef.current = relative
                    if (event.dataTransfer !== null) {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData(DRAG_TYPE, relative)
                      event.dataTransfer.setData('text/plain', relative)
                    }
                  },
                  onDragEnd: () => {
                    dragPathRef.current = null
                    setDropTarget(null)
                  },
                  onDragOver: (event) => handleTreeDragOver(event, isDir ? relative : dirname(relative)),
                  onDragLeave: (event) => handleTreeDragLeave(event, isDir ? relative : dirname(relative)),
                  onDrop: (event) => handleTreeDrop(event, isDir ? relative : dirname(relative)),
                  onClick: () => {
                    store.set((current) => ({ ...current, selected: relative }))
                    if (!isDir) void openFile(relative)
                  },
                  onDoubleClick: () => {
                    if (isDir) void toggleDir(relative)
                  },
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (isDir) void toggleDir(relative)
                      else void openFile(relative)
                    } else if (event.key === 'ArrowRight' && isDir && !directoryOpen) {
                      event.preventDefault()
                      void toggleDir(relative)
                    } else if (event.key === 'ArrowLeft' && isDir && directoryOpen) {
                      event.preventDefault()
                      void toggleDir(relative)
                    }
                  },
                  onContextMenu: (event) => openMenu(event, relative, isDir ? 'directory' : 'file'),
                },
                isDir
                  ? h(
                      'span',
                      {
                        className: 'ds-chevron',
                        'data-open': directoryOpen ? 'true' : undefined,
                        onClick: (event) => {
                          event.stopPropagation()
                          void toggleDir(relative)
                        },
                      },
                      h(ChevronIcon),
                    )
                  : h('span', { className: 'ds-chevron' }),
                isDir
                  ? h('span', { className: 'ds-glyph ds-glyph-folder' }, h(FolderIcon, { open: directoryOpen }))
                  : h(FileGlyph, { name: entry.name }),
                h('span', { className: 'ds-name' }, displayName),
                favoritePaths.has(relative)
                  ? h(
                      'span',
                      { className: 'ds-fav-mark', title: t('favorites') },
                      h(StarIcon, { filled: true, size: 11, className: 'ds-star-warn' }),
                    )
                  : null,
                entry.type === 'other' ? h('span', { className: 'ds-tag' }, t('hint.other')) : null,
              ),
            )
            if (isDir && directoryOpen) {
              for (const child of renderLevel(leaf, depth + 1)) nodes.push(child)
            }
          }
          return nodes
        }

        function breadcrumbSegments(tab) {
          if (tab === null) return []
          const parts = tab.path.split('/')
          const result = []
          let accumulated = ''
          for (const part of parts) {
            accumulated = joinPath(accumulated, part)
            result.push({ label: part, path: accumulated })
          }
          return result
        }

        function editorToolbar(tab) {
          if (tab.mode === 'terminal') {
            return h(
              'div',
              { className: 'ds-edit-toolbar ds-terminal-toolbar' },
              h('span', { className: 'ds-lang' }, t('terminal.label')),
              h('span', { className: 'ds-spacer' }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-toolbtn',
                  title: t('terminal.moveToPanel'),
                  onClick: () => moveTerminalToPanel(tab.terminalId),
                },
                h(PanelTopIcon),
                h('span', { className: 'ds-tool-label' }, t('terminal.moveToPanel')),
              ),
            )
          }
          if (tab.mode === 'browser') {
            const canBack = tab.historyIndex > 0
            const canForward = tab.historyIndex < tab.history.length - 1
            return h(
              'div',
              { className: 'ds-edit-toolbar ds-browser-toolbar' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-iconbtn ds-iconbtn-sm',
                  title: t('browser.back'),
                  disabled: !canBack,
                  onClick: () => browserStep(tab.path, -1),
                },
                h(ArrowLeftIcon),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-iconbtn ds-iconbtn-sm',
                  title: t('browser.forward'),
                  disabled: !canForward,
                  onClick: () => browserStep(tab.path, 1),
                },
                h(ArrowRightIcon),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-iconbtn ds-iconbtn-sm',
                  title: t('browser.reload'),
                  disabled: tab.url.length === 0,
                  onClick: () => reloadBrowser(tab.path),
                },
                h(RefreshIcon),
              ),
              h(
                'div',
                { className: 'ds-browser-device-switch', role: 'group', 'aria-label': t('browser.viewport') },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-browser-device-btn',
                    'data-active': tab.device !== 'mobile' ? 'true' : undefined,
                    title: t('browser.pcHint'),
                    onClick: () => setBrowserView(tab, { device: 'pc' }),
                  },
                  h(MonitorIcon),
                  h('span', null, t('browser.pc')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-browser-device-btn',
                    'data-active': tab.device === 'mobile' ? 'true' : undefined,
                    title: t('browser.mobileHint'),
                    onClick: () => setBrowserView(tab, { device: 'mobile' }),
                  },
                  h(PhoneIcon),
                  h('span', null, t('browser.mobile')),
                ),
              ),
              tab.url.length === 0 || isDirectPreviewUrl(tab.url)
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-browser-proxy-btn',
                      'data-active': tab.proxy === true ? 'true' : undefined,
                      title: t('browser.proxyHint'),
                      onClick: () => toggleBrowserProxy(tab),
                    },
                    tab.proxy === true ? t('browser.proxy') : t('browser.direct'),
                  ),
              h(
                'form',
                {
                  className: 'ds-browser-address-form',
                  onSubmit: (event) => {
                    event.preventDefault()
                    navigateBrowser(tab.path, tab.input)
                  },
                },
                h('input', {
                  className: 'ds-browser-address',
                  value: tab.input,
                  placeholder: t('browser.placeholder'),
                  spellCheck: false,
                  autoFocus: tab.url.length === 0,
                  'aria-label': t('browser.address'),
                  onChange: (event) => patchTab(tab.path, { input: event.target.value }),
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      patchTab(tab.path, { input: tab.url })
                    }
                  },
                }),
              ),
              tab.device === 'mobile'
                ? h(
                    'select',
                    {
                      className: 'ds-browser-preset',
                      value: tab.mobilePreset ?? 'iphone14',
                      title: t('browser.device'),
                      onChange: (event) => setBrowserView(tab, { mobilePreset: event.target.value }),
                    },
                    Object.entries(BROWSER_DEVICES).map(([key, item]) => h('option', { key, value: key }, item.label)),
                  )
                : null,
              tab.device === 'mobile'
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('browser.rotate'),
                      onClick: () =>
                        setBrowserView(tab, {
                          orientation: tab.orientation === 'landscape' ? 'portrait' : 'landscape',
                        }),
                    },
                    h(RotateIcon),
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-iconbtn ds-iconbtn-sm',
                  title: t('browser.openExternal'),
                  disabled: tab.url.length === 0,
                  onClick: () => window.open(tab.url, '_blank', 'noopener,noreferrer'),
                },
                h(ExternalIcon),
              ),
            )
          }
          if (tab.mode === 'diff') {
            return h(
              'div',
              { className: 'ds-edit-toolbar' },
              h(
                'div',
                { className: 'ds-git-diff-modes', role: 'group', 'aria-label': t('git.diffMode') },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-git-diff-mode',
                    'data-active': tab.diffMode !== 'unified' ? 'true' : undefined,
                    title: t('git.diffSplitHint'),
                    onClick: () => patchTab(tab.path, { diffMode: 'split' }),
                  },
                  t('git.diffSplit'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-git-diff-mode',
                    'data-active': tab.diffMode === 'unified' ? 'true' : undefined,
                    title: t('git.diffUnifiedHint'),
                    onClick: () => patchTab(tab.path, { diffMode: 'unified' }),
                  },
                  t('git.diffUnified'),
                ),
              ),
              h('span', { className: 'ds-spacer' }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-toolbtn',
                  title: t('git.refreshDiff'),
                  disabled: tab.loading,
                  onClick: () => void loadDiffInto(tab.path, state.root, tab.diff),
                },
                h(RefreshIcon),
                h('span', { className: 'ds-tool-label' }, t('git.refreshDiff')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-toolbtn',
                  title: t('git.openFile'),
                  disabled: typeof tab.diff?.path !== 'string',
                  onClick: () => {
                    if (typeof tab.diff?.path === 'string') void openFile(tab.diff.path)
                  },
                },
                h(PageIcon),
                h('span', { className: 'ds-tool-label' }, t('git.openFile')),
              ),
            )
          }
          const isMarkdown = tab.mode === 'markdown'
          return h(
            'div',
            { className: 'ds-edit-toolbar' },
            isMarkdown
              ? h(
                  'div',
                  { className: 'ds-switch', role: 'group' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-switch-btn',
                      'data-active': tab.view === 'preview' ? 'true' : undefined,
                      onClick: () => patchTab(tab.path, { view: 'preview' }),
                    },
                    h(EyeIcon),
                    t('action.preview'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-switch-btn',
                      'data-active': tab.view === 'edit' ? 'true' : undefined,
                      onClick: () => patchTab(tab.path, { view: 'edit' }),
                    },
                    h(CodeIcon),
                    t('action.edit'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-switch-btn',
                      'data-active': tab.view === 'split' ? 'true' : undefined,
                      onClick: () => patchTab(tab.path, { view: tab.view === 'split' ? 'edit' : 'split' }),
                    },
                    h(PanelRightIcon),
                    t('action.split'),
                  ),
                )
              : h('span', { className: 'ds-lang' }, tab.language.label),
            h('span', { className: 'ds-spacer' }),
            isTextMode(tab.mode)
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-toolbtn ds-agent-btn',
                    title: t('agent.open'),
                    onClick: () => setAgentOpen(true),
                  },
                  h(ChatIcon),
                  h('span', { className: 'ds-tool-label' }, t('agent.short')),
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'ds-toolbtn',
                title: t('action.download'),
                onClick: () => downloadFile(tab.path),
              },
              h(DownloadIcon),
              h('span', { className: 'ds-tool-label' }, t('action.downloadShort')),
            ),
            isTextMode(tab.mode)
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-switch-btn ds-wrap-toggle',
                    'data-active': state.wordWrap ? 'true' : undefined,
                    title: state.wordWrap ? t('action.nowrap') : t('action.wrap'),
                    'aria-pressed': state.wordWrap,
                    onClick: toggleWordWrap,
                  },
                  h(WrapIcon),
                  h('span', { className: 'ds-wrap-label' }, t('action.wrapShort')),
                )
              : null,
            isTextMode(tab.mode)
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-toolbtn',
                    title: t('action.copyAll'),
                    disabled: tab.loading,
                    onClick: () => void copyFullText(tab),
                  },
                  h(CopyIcon),
                  h('span', { className: 'ds-tool-label' }, t('action.copyShort')),
                )
              : null,
            isTextMode(tab.mode)
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-iconbtn',
                    title: t('action.reload'),
                    onClick: () => requestReloadTab(tab.path),
                  },
                  h(RefreshIcon),
                )
              : null,
            isTextMode(tab.mode)
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-savebtn',
                    disabled: !tab.dirty,
                    onClick: () => void saveTab(tab.path),
                  },
                  h(SaveIcon),
                  t('action.save'),
                  tab.dirty ? h('span', { className: 'ds-dirty-dot' }) : null,
                )
              : null,
            !isTextMode(tab.mode)
              ? h(
                  'button',
                  { type: 'button', className: 'ds-linkbtn', onClick: () => openExternal(tab.path) },
                  h(ExternalIcon),
                  t('action.openInBrowser'),
                )
              : null,
          )
        }

        function textEditorNode(tab) {
          return h(CodeEditor, {
            key: tab.path,
            tab,
            language: tab.language,
            t,
            wrap: state.wordWrap,
            onChange: (content) =>
              store.set((current) => ({
                ...current,
                tabs: current.tabs.map((entry) =>
                  entry.path === tab.path
                    ? { ...entry, content, dirty: content !== entry.saved }
                    : entry,
                ),
              })),
            onSave: () => void saveTab(tab.path),
            onCursor: setCursor,
            onSelection: (selection) =>
              setEditorSelection(selection === null ? null : { ...selection, path: tab.path }),
          })
        }

        function tabBody(tab) {
          if (tab.mode === 'terminal') {
            const session = terminals.find((entry) => entry.id === tab.terminalId)
            if (session === undefined) return h('div', { className: 'ds-empty' }, t('terminal.sessionMissing'))
            return h(TerminalView, {
              key: session.hostId,
              session,
              t,
              onStatus: (id, status, code) => updateTerminalSession(id, { status, exitCode: code ?? null }),
            })
          }
          if (tab.mode === 'diff') return h(DiffView, { tab, t })
          if (tab.loading) {
            return h('div', { className: 'ds-empty' }, h('span', { className: 'ds-spinner' }), t('hint.loadingFile'))
          }
          if (tab.error !== null) {
            const canOpen = tab.code === 'binary' || tab.code === 'too-large'
            return h(
              'div',
              { className: 'ds-empty ds-empty-error' },
              h(
                'div',
                { className: 'ds-empty-title' },
                tab.code === 'binary' ? t('hint.binary') : tab.code === 'too-large' ? t('hint.tooLarge') : t('title.readError'),
              ),
              h('div', { className: 'ds-empty-text' }, tab.error),
              h(
                'div',
                { className: 'ds-empty-actions' },
                isTextMode(tab.mode)
                  ? h(
                      'button',
                      { type: 'button', className: 'ds-btn', onClick: () => void reloadTab(tab.path) },
                      h(RefreshIcon),
                      t('action.reload'),
                    )
                  : null,
                canOpen
                  ? h(
                      'button',
                      { type: 'button', className: 'ds-btn', onClick: () => openExternal(tab.path) },
                      h(ExternalIcon),
                      t('file.openExternal'),
                    )
                  : null,
              ),
            )
          }
          if (tab.mode === 'pdf') {
            return h(
              'div',
              { className: 'ds-pdfwrap' },
              h('iframe', {
                className: 'ds-pdf',
                src: rawUrl(state.root, tab.path),
                title: tab.name,
              }),
            )
          }
          if (tab.mode === 'image') {
            return h(
              'div',
              { className: 'ds-imageview' },
              h('img', { src: rawUrl(state.root, tab.path), alt: tab.name }),
            )
          }
          if (tab.mode === 'binary') {
            return h(
              'div',
              { className: 'ds-empty' },
              h('div', { className: 'ds-empty-title' }, t('hint.binary')),
              h(
                'button',
                { type: 'button', className: 'ds-btn', onClick: () => openExternal(tab.path) },
                h(ExternalIcon),
                t('file.openExternal'),
              ),
            )
          }
          if (tab.mode === 'markdown' && tab.view === 'preview') {
            return h(MarkdownView, {
              key: tab.path,
              text: tab.content,
              root: state.root,
              file: tab.path,
              onOpenPath: (relative) => {
                if (relative.endsWith('/')) {
                  void ensureExpanded(relative.replace(/\/$/u, ''))
                } else {
                  void openFile(relative)
                }
              },
              t,
            })
          }
          if (tab.mode === 'markdown' && tab.view === 'split') {
            return h(
              'div',
              { className: 'ds-md-split-wrap' },
              h(
                'div',
                { className: 'ds-md-split-bar' },
                h('span', { className: 'ds-md-split-label' }, t('action.split')),
                h('span', { className: 'ds-spacer' }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-linkbtn',
                    onClick: () => patchTab(tab.path, { view: 'edit' }),
                  },
                  t('action.splitExit'),
                ),
              ),
              h(
                'div',
                {
                  className: 'ds-md-split',
                  ref: mdSplitRef,
                  'data-stacked': splitStacked ? 'true' : undefined,
                  style: splitStacked
                    ? undefined
                    : { gridTemplateColumns: `${String(mdSplitRatio)}% 5px minmax(0, 1fr)` },
                },
                h('div', { className: 'ds-md-split-pane ds-md-split-editor' }, textEditorNode(tab)),
                h('div', {
                  className: 'ds-md-split-divider',
                  role: 'separator',
                  'aria-orientation': 'vertical',
                  title: t('action.split'),
                  onPointerDown: beginMdSplitDrag,
                  onDoubleClick: () => setMdSplitRatio(50),
                }),
                h(
                  'div',
                  { className: 'ds-md-split-pane ds-md-split-preview' },
                  h(MarkdownView, {
                    key: `${tab.path}:split-preview`,
                    text: tab.content,
                    root: state.root,
                    file: tab.path,
                    onOpenPath: (relative) => {
                      if (relative.endsWith('/')) {
                        void ensureExpanded(relative.replace(/\/$/u, ''))
                      } else {
                        void openFile(relative)
                      }
                    },
                    t,
                  }),
                ),
              ),
            )
          }
          return textEditorNode(tab)

        }

        function renderWorkspaceSelect() {
          if (state.roots.length === 0) {
            return h(
              'div',
              { className: 'ds-workspace-wrap' },
              h('span', { className: 'ds-workspace-empty' }, t('root.none')),
              h(
                'button',
                { type: 'button', className: 'ds-ws-add', onClick: () => openSshDialog() },
                h(PlusIcon),
                t('ssh.add'),
              ),
            )
          }
          return h(
            'div',
            { className: 'ds-workspace-wrap' },
            h(
              'button',
              {
                type: 'button',
                className: 'ds-workspace-btn',
                title: t('workspace.pickTitle'),
                'aria-haspopup': 'listbox',
                'aria-expanded': pickerOpen,
                onClick: () => setPickerOpen((open) => !open),
              },
              h('span', { className: 'ds-workspace-btn-title' }, state.rootTitle || t('workspace.label')),
              h('span', { className: 'ds-workspace-btn-path' }, state.root ?? ''),
              h('span', { className: 'ds-chevron', 'data-open': pickerOpen ? 'true' : undefined }, h(ChevronIcon)),
            ),
            pickerOpen
              ? h(
                  'div',
                  { className: 'ds-workspace-menu', role: 'listbox' },
                  state.roots.map((root) => {
                    const active = root.path === state.root
                    return h(
                      'div',
                      {
                        key: root.path,
                        className: 'ds-ws-row',
                        'data-active': active ? 'true' : undefined,
                        role: 'option',
                        'aria-selected': active,
                      },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ds-ws-pick',
                          onClick: () => {
                            setPickerOpen(false)
                            switchRoot(root.path)
                          },
                        },
                        h('span', { className: 'ds-ws-title' }, root.title || basename(root.path)),
                        h('span', { className: 'ds-ws-path' }, root.path),
                      ),
                      active ? h('span', { className: 'ds-ws-check', 'aria-hidden': true }, '✓') : null,
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ds-ws-remove',
                          title: t('action.removeWorkspace'),
                          onClick: (event) => {
                            event.stopPropagation()
                            requestRemoveWorkspace(root)
                          },
                        },
                        h(TrashIcon),
                      ),
                    )
                  }),
                  h('div', { className: 'ds-menu-sep' }),
                  h(
                    'button',
                    { type: 'button', className: 'ds-ws-add', onClick: () => openSshDialog() },
                    h(PlusIcon),
                    t('ssh.add'),
                  ),
                )
              : null,
          )
        }

        function renderSearchPanel() {
          const matches = Array.isArray(searchResults?.matches) ? searchResults.matches : []
          const grouped = new Map()
          for (const match of matches) {
            const list = grouped.get(match.path)
            if (list === undefined) grouped.set(match.path, [match])
            else list.push(match)
          }
          return h(
            'div',
            { className: 'ds-side-view ds-search-view', style: { display: showSearch ? 'flex' : 'none' } },
            h(
              'div',
              { className: 'ds-search-form' },
              h('input', {
                ref: searchInputRef,
                className: 'ds-search-input',
                value: searchQuery,
                placeholder: t('search.placeholder'),
                spellCheck: false,
                onChange: (event) => setSearchQuery(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void runSearch()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    clearSearch()
                  }
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-search-run',
                  title: t('search.run'),
                  disabled: searchBusy || searchQuery.trim().length === 0,
                  onClick: () => void runSearch(),
                },
                h(SearchIcon),
              ),
              h(
                'div',
                { className: 'ds-search-options' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-toggle',
                    'data-active': searchCase ? 'true' : undefined,
                    title: t('search.case'),
                    onClick: () => setSearchCase((value) => !value),
                  },
                  'Aa',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-toggle',
                    'data-active': searchRegex ? 'true' : undefined,
                    title: t('search.regex'),
                    onClick: () => setSearchRegex((value) => !value),
                  },
                  '.*',
                ),
                h('span', { className: 'ds-spacer' }),
                searchBusy
                  ? h('span', { className: 'ds-search-meta' }, t('search.busy'))
                  : searchResults === null
                    ? null
                    : h('span', { className: 'ds-search-meta' }, t('search.results', { count: String(matches.length) })),
              ),
            ),
            searchError !== null
              ? h('div', { className: 'ds-errorline' }, searchError)
              : searchResults === null
                ? h('div', { className: 'ds-hint' }, t('search.empty'))
                : matches.length === 0
                  ? h('div', { className: 'ds-hint' }, t('search.noResults'))
                  : h(
                      'div',
                      { className: 'ds-search-results' },
                      searchResults.truncated === true
                        ? h('div', { className: 'ds-hint' }, t('search.truncated', { count: String(matches.length) }))
                        : null,
                      [...grouped.entries()].map(([file, list]) =>
                        h(
                          'div',
                          { key: file, className: 'ds-search-file' },
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'ds-search-file-head',
                              title: file,
                              onClick: () => void openFileAt(file, list[0].line, list[0].column),
                            },
                            h(FileGlyph, { name: basename(file), size: 14 }),
                            h('span', { className: 'ds-search-file-name' }, basename(file)),
                            h('span', { className: 'ds-search-file-count' }, String(list.length)),
                          ),
                          h(
                            'div',
                            { className: 'ds-search-file-path' },
                            dirname(file) || '.',
                          ),
                          list.map((match, index) =>
                            h(
                              'button',
                              {
                                key: `${file}:${match.line}:${match.column}:${index}`,
                                type: 'button',
                                className: 'ds-search-hit',
                                onClick: () => void openFileAt(file, match.line, match.column),
                              },
                              h('span', { className: 'ds-search-line' }, String(match.line)),
                              h('span', { className: 'ds-search-text', title: match.text }, match.text),
                            ),
                          ),
                        ),
                      ),
                    ),
          )
        }

        function renderHarnessPanel() {
          if (harnessConfig !== null) {
            return h(
              'div',
              { className: 'ds-side-view ds-harness-view', style: { display: showHarness ? 'flex' : 'none' } },
              h(
                'div',
                { className: 'ds-harness-config-head' },
                h(
                  'button',
                  { type: 'button', className: 'ds-linkbtn', onClick: () => setHarnessConfig(null) },
                  t('harness.closeConfig'),
                ),
                h('span', { className: 'ds-harness-config-name' }, harnessConfig.name),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-linkbtn',
                    onClick: () => {
                      if (typeof navigator.clipboard?.writeText === 'function') {
                        void navigator.clipboard.writeText(harnessConfig.content).catch(() => {})
                      }
                    },
                  },
                  t('harness.copy'),
                ),
              ),
              h('pre', { className: 'ds-harness-config' }, harnessConfig.content),
            )
          }
          if (harnessBusy && harnessInfo === null) return h('div', { className: 'ds-hint' }, t('harness.loading'))
          if (harnessError !== null) {
            return h(
              'div',
              { className: 'ds-side-view ds-harness-view', style: { display: showHarness ? 'flex' : 'none' } },
              h('div', { className: 'ds-errorline' }, harnessError),
              h(
                'button',
                { type: 'button', className: 'ds-linkbtn', onClick: () => void loadHarness(true) },
                t('action.retry'),
              ),
            )
          }
          if (harnessInfo === null) return h('div', { className: 'ds-hint' }, t('harness.loading'))
          const bundles = Array.isArray(harnessInfo.bundles) ? harnessInfo.bundles : []
          const dependencies = Array.isArray(harnessInfo.dependencies) ? harnessInfo.dependencies : []
          const files = Array.isArray(harnessInfo.files) ? harnessInfo.files : []
          return h(
            'div',
            { className: 'ds-side-view ds-harness-view', style: { display: showHarness ? 'flex' : 'none' } },
            h(
              'div',
              { className: 'ds-harness-section' },
              h('div', { className: 'ds-harness-label' }, t('harness.profile')),
              h('div', { className: 'ds-harness-value' }, harnessInfo.profile?.name ?? ''),
              h('div', { className: 'ds-harness-path', title: harnessInfo.profile?.dir ?? '' }, harnessInfo.profile?.dir ?? ''),
              h('div', { className: 'ds-harness-label' }, t('harness.version')),
              h('div', { className: 'ds-harness-value' }, `v${harnessInfo.version ?? pluginVersion ?? '?'}`),
            ),
            h(
              'div',
              { className: 'ds-harness-section' },
              h('div', { className: 'ds-harness-label' }, t('harness.bundles')),
              bundles.length === 0
                ? h('div', { className: 'ds-hint' }, '—')
                : bundles.map((name) => h('div', { key: name, className: 'ds-harness-item' }, name)),
            ),
            dependencies.length === 0
              ? null
              : h(
                  'div',
                  { className: 'ds-harness-section' },
                  h('div', { className: 'ds-harness-label' }, t('harness.dependencies')),
                  dependencies.map((entry) =>
                    h('div', { key: entry.name, className: 'ds-harness-item' }, `${entry.name} ${entry.version}`),
                  ),
                ),
            h(
              'div',
              { className: 'ds-harness-section' },
              h('div', { className: 'ds-harness-label' }, t('harness.config')),
              files.length === 0
                ? h('div', { className: 'ds-hint' }, t('harness.noConfig'))
                : files.map((file) =>
                    h(
                      'button',
                      {
                        key: file.name,
                        type: 'button',
                        className: 'ds-harness-file',
                        disabled: harnessConfigBusy,
                        onClick: () => void openHarnessConfig(file.name),
                      },
                      h(PageIcon),
                      h('span', null, file.name),
                    ),
                  ),
            ),
            h(
              'div',
              { className: 'ds-harness-section' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-btn ds-harness-check',
                  disabled: harnessChecking,
                  onClick: () => void runHarnessCheckNow(),
                },
                harnessChecking ? t('harness.checking') : t('harness.check'),
              ),
              harnessCheck === null
                ? null
                : h(
                    'div',
                    { className: 'ds-harness-check-result' },
                    h(
                      'div',
                      { className: harnessCheck.code === 0 ? 'ds-harness-ok' : 'ds-harness-fail' },
                      harnessCheck.code === 0
                        ? t('harness.checkOk')
                        : t('harness.checkFailed', { code: String(harnessCheck.code) }),
                    ),
                    h('pre', { className: 'ds-harness-output' }, harnessCheck.output || '—'),
                  ),
            ),
          )
        }

        function renderPalette() {
          if (!paletteOpen) return null
          const query = paletteQuery.trim().toLowerCase()
          const commands = paletteMode === 'commands' ? paletteCommands() : []
          const items =
            paletteMode === 'files'
              ? paletteFiles
                  .filter((file) => query.length === 0 || file.path.toLowerCase().includes(query))
                  .sort((left, right) => left.path.length - right.path.length || left.path.localeCompare(right.path))
                  .slice(0, 120)
              : commands.filter((command) => query.length === 0 || command.label.toLowerCase().includes(query))
          const index = items.length === 0 ? 0 : Math.min(paletteIndex, items.length - 1)
          const inputPlaceholder = paletteMode === 'files' ? t('palette.filesPlaceholder') : t('palette.commandsPlaceholder')
          return h(
            'div',
            {
              className: 'ds-palette-backdrop',
              onPointerDown: (event) => {
                if (event.target === event.currentTarget) closePalette()
              },
            },
            h(
              'div',
              { className: 'ds-palette', role: 'dialog', 'aria-modal': true },
              h('div', { className: 'ds-palette-title' }, paletteMode === 'files' ? t('palette.files') : t('palette.commands')),
              h('input', {
                ref: paletteInputRef,
                className: 'ds-palette-input',
                value: paletteQuery,
                placeholder: inputPlaceholder,
                spellCheck: false,
                onChange: (event) => {
                  setPaletteQuery(event.target.value)
                  setPaletteIndex(0)
                },
                onKeyDown: (event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setPaletteIndex((value) => (items.length === 0 ? 0 : (value + 1) % items.length))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setPaletteIndex((value) => (items.length === 0 ? 0 : (value - 1 + items.length) % items.length))
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    const item =
                      paletteMode === 'files'
                        ? items[index] === undefined
                          ? undefined
                          : { run: () => void openFileAt(items[index].path, 1, 1) }
                        : items[index]
                    runPaletteItem(item)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    closePalette()
                  }
                },
              }),
              paletteError !== null
                ? h('div', { className: 'ds-errorline' }, paletteError)
                : paletteBusy
                  ? h('div', { className: 'ds-hint' }, t('palette.loading'))
                  : items.length === 0
                    ? h(
                        'div',
                        { className: 'ds-hint' },
                        paletteMode === 'files' ? t('palette.noFiles') : t('palette.noCommands'),
                      )
                    : h(
                        'div',
                        { className: 'ds-palette-list' },
                        items.map((item, itemIndex) =>
                          h(
                            'button',
                            {
                              key: paletteMode === 'files' ? item.path : item.id,
                              type: 'button',
                              className: 'ds-palette-item',
                              'data-active': itemIndex === index ? 'true' : undefined,
                              onMouseEnter: () => setPaletteIndex(itemIndex),
                              onClick: () =>
                                runPaletteItem(
                                  paletteMode === 'files'
                                    ? { run: () => void openFileAt(item.path, 1, 1) }
                                    : item,
                                ),
                            },
                            paletteMode === 'files'
                              ? h(FileGlyph, { name: item.name, size: 14 })
                              : h(SearchIcon),
                            h(
                              'span',
                              { className: 'ds-palette-item-name' },
                              paletteMode === 'files' ? item.name : item.label,
                            ),
                            paletteMode === 'files'
                              ? h('span', { className: 'ds-palette-item-path' }, dirname(item.path) || '.')
                              : null,
                          ),
                        ),
                      ),
              h('div', { className: 'ds-palette-hint' }, t('palette.hint')),
            ),
          )
        }

        function renderAgentModal() {
          if (!agentOpen) return null
          const tab = activeTab
          if (tab === null || !isTextMode(tab.mode)) return null
          const context = agentContext()
          const selection = context?.selection ?? null
          const preview = context?.text ?? ''
          const range = selection === null
            ? t('agent.fileOnly')
            : t('agent.selection', { start: String(context.startLine), end: String(context.endLine) })
          return h(
            'div',
            {
              className: 'ds-modal-backdrop',
              onPointerDown: (event) => {
                if (event.target === event.currentTarget && !agentSending) setAgentOpen(false)
              },
            },
            h(
              'div',
              { className: 'ds-modal ds-agent-modal', role: 'dialog', 'aria-modal': true },
              h('div', { className: 'ds-modal-title' }, t('agent.title')),
              h('div', { className: 'ds-modal-text' }, t('agent.hint')),
              h(
                'div',
                { className: 'ds-agent-context' },
                h('span', { className: 'ds-agent-path' }, tab.path),
                h('span', { className: 'ds-agent-range' }, range),
              ),
              preview.length === 0
                ? null
                : h(
                    'div',
                    { className: 'ds-agent-preview-wrap' },
                    h('div', { className: 'ds-agent-preview-label' }, t('agent.preview')),
                    h('pre', { className: 'ds-agent-preview' }, preview.slice(0, 5000)),
                  ),
              h(
                'div',
                { className: 'ds-agent-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-btn',
                    disabled: agentSending || selection === null,
                    onClick: () => void sendAgentPrompt('explain'),
                  },
                  t('agent.explain'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-btn',
                    disabled: agentSending || selection === null,
                    onClick: () => void sendAgentPrompt('fix'),
                  },
                  t('agent.fix'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-btn',
                    disabled: agentSending || selection === null,
                    onClick: () => void sendAgentPrompt('tests'),
                  },
                  t('agent.tests'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-btn ds-btn-primary',
                    disabled: agentSending || preview.length === 0,
                    onClick: () => void sendAgentPrompt('file'),
                  },
                  t('agent.file'),
                ),
              ),
              h(
                'div',
                { className: 'ds-modal-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-btn',
                    disabled: agentSending,
                    onClick: () => setAgentOpen(false),
                  },
                  t('action.cancel'),
                ),
              ),
            ),
          )
        }

        const segments = activeTab === null || activeTab.mode === 'diff' || activeTab.mode === 'browser' || activeTab.mode === 'terminal' ? [] : breadcrumbSegments(activeTab)
        const lineCount = activeTab !== null && isTextMode(activeTab.mode) ? activeTab.content.split('\n').length : 0
        const panelSessions = terminals.filter((session) => session.placement === 'panel')
        const activePanelSession =
          panelSessions.find((session) => session.id === terminalPanelActive) ?? panelSessions[0] ?? null
        const terminalPanel =
          terminalPanelOpen && panelSessions.length > 0
            ? h(
                'section',
                { className: 'ds-terminal-panel', style: { height: `${String(terminalPanelHeight)}px` } },
                h('div', {
                  className: 'ds-terminal-resize',
                  role: 'separator',
                  'aria-orientation': 'horizontal',
                  title: t('terminal.resize'),
                  onPointerDown: startTerminalResize,
                }),
                h(
                  'div',
                  { className: 'ds-terminal-tabs', role: 'tablist', 'aria-label': t('terminal.tabs') },
                  panelSessions.map((session) =>
                    h(
                      'div',
                      {
                        key: session.id,
                        className: 'ds-terminal-tab',
                        'data-active': session.id === activePanelSession?.id ? 'true' : undefined,
                      },
                      h(
                        'button',
                        {
                          type: 'button',
                          role: 'tab',
                          className: 'ds-terminal-tab-btn',
                          'aria-selected': session.id === activePanelSession?.id,
                          title: session.title,
                          onClick: () => setTerminalPanelActive(session.id),
                        },
                        h(TerminalIcon),
                        h('span', { className: 'ds-terminal-tab-name' }, session.title),
                        session.status === 'closed' ? h('span', { className: 'ds-terminal-tab-dot' }) : null,
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ds-terminal-tab-close',
                          title: t('terminal.close'),
                          onClick: () => closeTerminalSession(session.id),
                        },
                        h(CloseIcon),
                      ),
                    ),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('terminal.new'),
                      onClick: () => void openTerminal('panel'),
                    },
                    h(PlusIcon),
                  ),
                  h('span', { className: 'ds-spacer' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('terminal.moveToEditor'),
                      disabled: activePanelSession === null,
                      onClick: () => {
                        if (activePanelSession !== null) moveTerminalToEditor(activePanelSession.id)
                      },
                    },
                    h(PanelTopIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('terminal.closePanel'),
                      onClick: closeTerminalPanel,
                    },
                    h(CloseIcon),
                  ),
                ),
                activePanelSession === null
                  ? h('div', { className: 'ds-terminal-empty' }, t('terminal.empty'))
                  : h(TerminalView, {
                      key: activePanelSession.hostId,
                      session: activePanelSession,
                      t,
                      onStatus: (id, status, code) => updateTerminalSession(id, { status, exitCode: code ?? null }),
                    }),
              )
            : null

        return h(
          'div',
          { className: 'ds-root', ref: rootRef, onKeyDown: onRootKeyDown, 'data-compact': compact ? 'true' : undefined, 'data-maximized': maximized ? 'true' : undefined },
          h('style', null, CSS),
          h('input', {
            ref: uploadInputRef,
            type: 'file',
            multiple: true,
            style: { display: 'none' },
            onChange: handleUploadFiles,
          }),
          h('a', {
            ref: downloadAnchorRef,
            style: { position: 'absolute', width: '0', height: '0', opacity: '0', overflow: 'hidden', pointerEvents: 'none' },
            'aria-hidden': true,
          }),
          h(
            'header',
            { className: 'ds-header' },
            h(
              'div',
              { className: 'ds-header-title' },
              h('span', { className: 'ds-header-logo' }, h(PanelGlyph, { size: 20, active: true })),
              h('span', null, t('panel.title')),
            ),
            pluginVersion === null
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'ds-version',
                    'data-update': versionInfo?.updateAvailable === true ? 'true' : undefined,
                    'data-busy': versionBusy ? 'true' : undefined,
                    title: versionBusy
                      ? t('version.checking')
                      : versionInfo?.updateAvailable === true
                        ? t('version.updateTitle', { latest: versionInfo.latest })
                        : t('version.checkTitle'),
                    disabled: versionBusy,
                    onClick: () => void checkVersionNow(),
                  },
                  versionInfo?.updateAvailable === true
                    ? `v${pluginVersion} → v${versionInfo.latest}`
                    : `v${pluginVersion}`,
                ),
            h('span', { className: 'ds-vr' }),
            renderWorkspaceSelect(),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-header-root',
                title: t('action.jumpRoot'),
                onClick: jumpToWorkspaceRoot,
                disabled: state.root === null,
              },
              h(HomeIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-header-refresh',
                title: t('action.refreshRoots'),
                onClick: () => void loadRoots(),
                disabled: state.loadingRoots,
              },
              h(RefreshIcon),
            ),
            h(
              'div',
              { className: 'ds-address-wrap', title: t('address.placeholder') },
              h('input', {
                className: 'ds-address',
                value: address,
                placeholder: t('address.placeholder'),
                spellCheck: false,
                autoComplete: 'off',
                'aria-label': t('address.placeholder'),
                onChange: (event) => setAddress(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitAddress()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setAddress('')
                    event.currentTarget.blur()
                  }
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ds-address-go',
                  title: t('action.go'),
                  onClick: submitAddress,
                  disabled: address.trim().length === 0,
                },
                h(GoIcon),
                h('span', { className: 'ds-go-label' }, t('action.go')),
              ),
            ),
            h('span', { className: 'ds-spacer' }),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-header-new',
                title: t('action.newFile'),
                onClick: () => startCreate('file'),
                disabled: state.root === null,
              },
              h(NewFileIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-header-new',
                title: t('action.newFolder'),
                onClick: () => startCreate('directory'),
                disabled: state.root === null,
              },
              h(NewFolderIcon),
            ),
            h('span', { className: 'ds-vr' }),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-chat-float-btn',
                title: t('chat.openFloating'),
                'aria-pressed': chatOpen,
                'data-active': chatOpen ? 'true' : undefined,
                onClick: toggleChat,
              },
              h(ChatIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-terminal-toggle',
                title: t('terminal.toggle'),
                'aria-pressed': terminalPanelOpen,
                'data-active': terminalPanelOpen ? 'true' : undefined,
                onClick: toggleTerminalPanel,
              },
              h(TerminalIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-header-browser',
                title: t('browser.open'),
                onClick: () => openBrowser(),
              },
              h(GlobeIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-iconbtn ds-maximize-btn',
                title: maximized ? t('action.restore') : t('action.maximize'),
                'aria-pressed': maximized,
                onClick: toggleMaximize,
              },
              maximized ? h(MinimizeIcon) : h(MaximizeIcon),
            ),
          ),
          banner === null
            ? null
            : h(
                'div',
                { className: 'ds-banner', 'data-kind': banner.kind },
                h('span', { className: 'ds-banner-text' }, banner.message),
                ...(banner.actions ?? []).map((action, index) =>
                  h(
                    'button',
                    { key: index, type: 'button', className: 'ds-linkbtn', onClick: action.run },
                    action.label,
                  ),
                ),
                h(
                  'button',
                  { type: 'button', className: 'ds-iconbtn ds-banner-close', title: t('action.cancel'), onClick: () => setBanner(null) },
                  h(CloseIcon),
                ),
              ),
          h(
            'div',
            { className: 'ds-body', 'data-side': sidePosition },
            h(
              'aside',
              {
                className: 'ds-side',
                'data-view': showGit ? 'git' : showSearch ? 'search' : showHarness ? 'harness' : 'files',
                style: { width: treeDisplayWidth, display: showSide ? undefined : 'none' },
              },
              h(
                'div',
                { className: 'ds-pane-head' },
                h(
                  'span',
                  { className: 'ds-pane-title' },
                  h(
                    'span',
                    { className: 'ds-pane-title-text' },
                    showGit ? t('git.title') : showSearch ? t('side.search') : showHarness ? t('side.harness') : t('explorer'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm ds-side-switch',
                      title: sidePosition === 'left' ? t('side.moveRight') : t('side.moveLeft'),
                      onClick: () => {
                        const next = sidePosition === 'left' ? 'right' : 'left'
                        setSidePosition(next)
                        writeStorage(SIDE_POSITION_KEY, next)
                      },
                    },
                    sidePosition === 'left' ? h(PanelRightIcon) : h(PanelLeftIcon),
                  ),
                ),
                h(
                  'span',
                  { className: 'ds-pane-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('action.newFile'),
                      onClick: () => startCreate('file'),
                      disabled: state.root === null,
                    },
                    h(NewFileIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('action.newFolder'),
                      onClick: () => startCreate('directory'),
                      disabled: state.root === null,
                    },
                    h(NewFolderIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: uploading ? t('action.uploading') : t('action.upload'),
                      onClick: () => pickUploads(defaultParent()),
                      disabled: state.root === null || uploading,
                    },
                    h(UploadIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('action.collapseAll'),
                      onClick: collapseAll,
                      disabled: !canCollapse,
                    },
                    h(CollapseAllIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: state.showHidden ? t('action.hideHidden') : t('action.showHidden'),
                      'aria-pressed': state.showHidden,
                      'data-active': state.showHidden ? 'true' : undefined,
                      onClick: () => toggleShowHidden(),
                    },
                    state.showHidden ? h(VisibleFilesIcon) : h(HiddenFilesIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('action.jumpRoot'),
                      onClick: jumpToWorkspaceRoot,
                      disabled: state.root === null,
                    },
                    h(HomeIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: t('action.refresh'),
                      onClick: () => void refreshAll(),
                      disabled: state.root === null,
                    },
                    h(RefreshIcon),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'ds-side-view', style: { display: showFiles ? 'flex' : 'none' } },
                h(
                'div',
                { className: 'ds-favorites' },
                h(
                  'div',
                  {
                    className: 'ds-favorites-head',
                    role: 'button',
                    tabIndex: 0,
                    title: t('favorites'),
                    onClick: toggleFavoritesOpen,
                    onKeyDown: (event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleFavoritesOpen()
                      }
                    },
                  },
                  h(
                    'span',
                    { className: 'ds-chevron', 'data-open': state.favoritesOpen ? 'true' : undefined },
                    h(ChevronIcon),
                  ),
                  h('span', { className: 'ds-star-ink' }, h(StarIcon, { filled: true, size: 13 })),
                  h('span', { className: 'ds-favorites-title' }, t('favorites')),
                  h('span', { className: 'ds-favorites-count' }, String(rootFavorites.length)),
                  h('span', { className: 'ds-spacer' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ds-iconbtn ds-iconbtn-sm',
                      title: selectedIsFavorite ? t('favorite.removeSelected') : t('favorite.addSelected'),
                      'aria-pressed': selectedIsFavorite,
                      onClick: (event) => {
                        event.stopPropagation()
                        toggleFavorite(state.selected)
                      },
                      disabled: state.selected === null || state.selected === '',
                    },
                    h(StarIcon, {
                      filled: selectedIsFavorite,
                      size: 14,
                      className: selectedIsFavorite ? 'ds-star-warn' : undefined,
                    }),
                  ),
                ),
                state.favoritesOpen
                  ? h(
                      'div',
                      { className: 'ds-favorites-list' },
                      rootFavorites.length === 0
                        ? h('div', { className: 'ds-fav-empty' }, t('favorite.empty'))
                        : rootFavorites.map((item) =>
                            h(
                              'div',
                              {
                                key: item.path,
                                className: 'ds-fav-row',
                                role: 'button',
                                tabIndex: 0,
                                title: item.path,
                                'data-active': state.active === item.path ? 'true' : undefined,
                                onClick: () => void openFavorite(item),
                                onKeyDown: (event) => {
                                  if (event.target !== event.currentTarget) return
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    void openFavorite(item)
                                  }
                                },
                              },
                              item.type === 'directory'
                                ? h('span', { className: 'ds-glyph ds-glyph-folder' }, h(FolderIcon, { open: false }))
                                : h(FileGlyph, { name: item.name, size: 14 }),
                              h('span', { className: 'ds-fav-name' }, item.name),
                              h('span', { className: 'ds-fav-path' }, dirname(item.path) || '.'),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'ds-fav-remove',
                                  title: t('favorite.remove'),
                                  onClick: (event) => {
                                    event.stopPropagation()
                                    removeFavorite(item.path)
                                  },
                                },
                                h(CloseIcon),
                              ),
                            ),
                          ),
                    )
                  : null,
              ),
              state.loadingRoots
                ? h('div', { className: 'ds-hint' }, t('hint.loading'))
                : state.startError !== null
                  ? h(
                      'div',
                      { className: 'ds-errorline' },
                      h('span', null, state.startError),
                      h(
                        'button',
                        { type: 'button', className: 'ds-linkbtn', onClick: () => void loadRoots() },
                        t('action.retry'),
                      ),
                    )
                  : h(
                      'div',
                      {
                        className: 'ds-tree',
                        role: 'tree',
                        tabIndex: 0,
                        'data-drop': dropTarget === '' ? 'true' : undefined,
                        onDragOver: (event) => handleTreeDragOver(event, ''),
                        onDragLeave: (event) => handleTreeDragLeave(event, ''),
                        onDrop: (event) => handleTreeDrop(event, ''),
                        onContextMenu: (event) => {
                          event.preventDefault()
                          openMenu(event, '', 'directory')
                        },
                        onClick: (event) => {
                          if (event.target === event.currentTarget) store.set((current) => ({ ...current, selected: null }))
                        },
                      },
                      rootIsOpen
                        ? renderLevel('', 0)
                        : h(
                            'div',
                            { className: 'ds-hint' },
                            h(
                              'button',
                              { type: 'button', className: 'ds-linkbtn', onClick: () => void ensureExpanded('') },
                              t('action.open'),
                            ),
                          ),
                    ),
              ),
              renderSearchPanel(),
              renderHarnessPanel(),
              gitAvailable
                ? h(
                    'div',
                    { className: 'ds-side-view ds-side-view-git', style: { display: showGit ? 'flex' : 'none' } },
                    h(GitPanel, {
                      root: state.root,
                      t,
                      onOpenDiff: (request) => void openDiffView(request),
                      showToast,
                      onFilesChanged: () => void refreshTree(),
                    }),
                  )
                : null,
              h(
                'div',
                { className: 'ds-side-foot' },
                h('span', { className: 'ds-side-path', title: state.root ?? '' }, state.root ?? ''),
              ),
              h(
                'div',
                { className: 'ds-side-tabs', role: 'tablist', 'aria-label': t('side.tabs') },
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'tab',
                    className: 'ds-side-tab',
                    'data-active': showFiles ? 'true' : undefined,
                    'aria-selected': showFiles,
                    onClick: () => setPaneView('files'),
                  },
                  h(FolderIcon, { open: showFiles }),
                  h('span', null, t('explorer')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'tab',
                    className: 'ds-side-tab',
                    'data-active': showSearch ? 'true' : undefined,
                    'aria-selected': showSearch,
                    onClick: focusSearch,
                  },
                  h(SearchIcon),
                  h('span', null, t('side.search')),
                ),
                gitAvailable
                  ? h(
                      'button',
                      {
                        type: 'button',
                        role: 'tab',
                        className: 'ds-side-tab',
                        'data-active': showGit ? 'true' : undefined,
                        'aria-selected': showGit,
                        onClick: () => setPaneView('git'),
                      },
                      h(GitIcon),
                      h('span', null, t('git.title')),
                    )
                  : null,
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'tab',
                    className: 'ds-side-tab',
                    'data-active': showHarness ? 'true' : undefined,
                    'aria-selected': showHarness,
                    onClick: () => void openHarness(),
                  },
                  h(HarnessIcon),
                  h('span', null, t('side.harness')),
                ),
              ),
            ),
            h('div', {
              className: 'ds-splitter',
              role: 'separator',
              'aria-orientation': 'vertical',
              style: compact || maximized ? { display: 'none' } : undefined,
              onPointerDown: beginSplitDrag,
            }),
            h(
              'section',
              { className: 'ds-main', style: showMain ? undefined : { display: 'none' } },
              state.tabs.length === 0
                ? h(
                    'div',
                    { className: 'ds-welcome' },
                    h(
                      'div',
                      { className: 'ds-welcome-card' },
                      h('span', { className: 'ds-welcome-logo' }, h(PanelGlyph, { size: 44, active: true })),
                      h('div', { className: 'ds-welcome-title' }, t('welcomeTitle')),
                      h('div', { className: 'ds-welcome-text' }, t('welcomeHint')),
                      h('div', { className: 'ds-kbdline' }, t('welcomeShortcuts')),
                      h(
                        React.Fragment,
                        null,
                        state.root === null
                          ? null
                          : h(
                              'button',
                              { type: 'button', className: 'ds-btn ds-btn-primary', onClick: () => startCreate('file') },
                              h(NewFileIcon),
                              t('welcomeNewFile'),
                            ),
                        h(
                          'button',
                          { type: 'button', className: 'ds-btn', onClick: () => openBrowser() },
                          h(GlobeIcon),
                          t('browser.open'),
                        ),
                        state.root === null || isSshRootPath(state.root)
                          ? null
                          : h(
                              'button',
                              {
                                type: 'button',
                                className: 'ds-btn',
                                onClick: () => {
                                  if (terminals.some((entry) => entry.placement === 'panel')) setTerminalPanelOpen(true)
                                  else void openTerminal('panel')
                                },
                              },
                              h(TerminalIcon),
                              t('terminal.open'),
                            ),
                      ),
                    ),
                  )
                : h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      { className: 'ds-tabs', role: 'tablist' },
                      state.tabs.map((tab) =>
                        h(
                          'div',
                          {
                            key: tab.path,
                            className: 'ds-tab',
                            role: 'tab',
                            'data-active': tab.path === state.active ? 'true' : 'false',
                            'aria-selected': tab.path === state.active,
                            title:
                              tab.mode === 'browser'
                                ? tab.url.length > 0
                                  ? tab.url
                                  : t('browser.newTab')
                                : tab.mode === 'terminal'
                                  ? tab.name
                                : tab.mode === 'diff'
                                  ? `${tab.diff?.path ?? ''} · ${tab.diff?.tag ?? ''}`
                                  : tab.path,
                            onClick: () => {
                              store.set((current) => ({
                                ...current,
                                active: tab.path,
                                selected: tab.mode === 'browser' ? current.selected : (tab.diff?.path ?? tab.path),
                              }))
                              setCursor({ line: 1, column: 1 })
                              setCompactView('editor')
                            },
                            onAuxClick: (event) => {
                              if (event.button === 1) {
                                event.preventDefault()
                                requestClose(tab.path)
                              }
                            },
                          },
                          tab.mode === 'terminal'
                            ? h('span', { className: 'ds-glyph ds-glyph-terminal' }, h(TerminalIcon))
                            : tab.mode === 'browser'
                            ? h('span', { className: 'ds-glyph ds-glyph-browser' }, h(GlobeIcon))
                            : tab.mode === 'diff'
                            ? h('span', { className: 'ds-glyph ds-glyph-diff' }, h(CompareIcon))
                            : isTextMode(tab.mode)
                              ? h(FileGlyph, { name: tab.name, size: 14 })
                              : h(
                                'span',
                                { className: `ds-glyph ds-glyph-${tab.mode === 'pdf' ? 'pdf' : tab.mode === 'image' ? 'image' : 'plain'}` },
                                tab.mode === 'pdf' ? h(PageIcon) : h(PageIcon),
                              ),
                          h('span', { className: 'ds-tab-name' }, tab.name),
                          tab.mode === 'diff' && tab.diff?.tag
                            ? h('span', { className: 'ds-tab-tag', title: tab.diff.tag }, tab.diff.tag)
                            : null,
                          tab.dirty ? h('span', { className: 'ds-dot', title: t('hint.unsaved') }) : null,
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'ds-tabclose',
                              title: t('action.cancel'),
                              onClick: (event) => {
                                event.stopPropagation()
                                requestClose(tab.path)
                              },
                            },
                            h(CloseIcon),
                          ),
                        ),
                      ),
                    ),
                    activeTab === null
                      ? h('div', { className: 'ds-empty' }, t('hint.noFile'))
                      : h(
                          React.Fragment,
                          null,
                          h(
                            'div',
                            { className: 'ds-breadcrumb' },
                            compact
                              ? h(
                                  'button',
                                  {
                                    type: 'button',
                                    className: 'ds-iconbtn ds-iconbtn-sm',
                                    title: t('compact.back'),
                                    onClick: () => setCompactView('tree'),
                                  },
                                  h(ChevronLeftIcon),
                                )
                              : null,
                            h(
                              'span',
                              { className: 'ds-breadcrumb-root', title: state.root ?? '' },
                              h(FolderIcon, { open: true }),
                              h('span', null, state.rootTitle || t('workspace.label')),
                            ),
                            activeTab.mode === 'browser'
                              ? h(
                                  React.Fragment,
                                  null,
                                  h('span', { className: 'ds-crumb-sep' }, '/'),
                                  h(
                                    'span',
                                    { className: 'ds-crumb ds-crumb-browser', title: activeTab.url },
                                    activeTab.url.length > 0 ? activeTab.url : t('browser.newTab'),
                                  ),
                                )
                              : activeTab.mode === 'diff'
                              ? h(
                                  React.Fragment,
                                  null,
                                  h('span', { className: 'ds-crumb-sep' }, '/'),
                                  h(
                                    'span',
                                    {
                                      className: 'ds-crumb ds-crumb-diff',
                                      title: activeTab.diff?.path ?? '',
                                    },
                                    activeTab.diff?.path ?? '',
                                  ),
                                  activeTab.diff?.tag
                                    ? h('span', { className: 'ds-git-diff-tag' }, activeTab.diff.tag)
                                    : null,
                                )
                              : segments.map((segment, index) =>
                                  h(
                                    React.Fragment,
                                    { key: segment.path },
                                    h('span', { className: 'ds-crumb-sep' }, '/'),
                                    h(
                                      'button',
                                      {
                                        type: 'button',
                                        className: 'ds-crumb',
                                        onClick: () => {
                                          void ensureExpanded(dirname(segment.path))
                                          if (index === segments.length - 1) {
                                            store.set((current) => ({ ...current, selected: segment.path }))
                                          } else {
                                            void ensureExpanded(segment.path)
                                            store.set((current) => ({ ...current, selected: segment.path }))
                                          }
                                        },
                                      },
                                      segment.label,
                                    ),
                                  ),
                                ),
                            h('span', { className: 'ds-spacer' }),
                            editorToolbar(activeTab),
                          ),
                          state.tabs
                            .filter((tab) => tab.mode === 'browser')
                            .map((tab) =>
                              h(
                                'div',
                                {
                                  key: tab.path,
                                  className: 'ds-browser-pane',
                                  'data-active': tab.path === state.active ? 'true' : 'false',
                                  style: { display: tab.path === state.active ? 'flex' : 'none' },
                                },
                                h(BrowserPanel, {
                                  tab,
                                  t,
                                  onNavigate: (url) => navigateBrowser(tab.path, url),
                                  onFinished: () => patchTab(tab.path, { loading: false }),
                                  onDismissMixed: () => patchTab(tab.path, { mixedDismissed: true }),
                                  host: previewHost,
                                  onHostChange: updatePreviewHost,
                                  scheme: previewScheme,
                                  onSchemeChange: updatePreviewScheme,
                                  onExternal: (targetUrl) => {
                                    const target = normalizeBrowserUrl(
                                      typeof targetUrl === 'string' && targetUrl.length > 0 ? targetUrl : tab.url,
                                      tab.url,
                                    )
                                    if (target !== null) window.open(target, '_blank', 'noopener,noreferrer')
                                  },
                                }),
                              ),
                            ),
                          activeTab.mode === 'browser' ? null : tabBody(activeTab),
                          h(
                            'footer',
                            { className: 'ds-statusbar' },
                            h(
                              'span',
                              { className: 'ds-status-item' },
                              isTextMode(activeTab.mode)
                                ? activeTab.language.label
                                : activeTab.mode === 'diff'
                                  ? `DIFF · ${activeTab.diff?.tag ?? ''}`
                                  : activeTab.mode.toUpperCase(),
                            ),
                            isTextMode(activeTab.mode)
                              ? h('span', { className: 'ds-status-item' }, t('status.lines', { count: String(lineCount) }))
                              : null,
                            h(
                              'span',
                              { className: 'ds-status-item' },
                              activeTab.mode === 'browser'
                                ? activeTab.url.length > 0
                                  ? activeTab.url
                                  : t('browser.newTab')
                                : activeTab.mode === 'terminal'
                                  ? t('terminal.local')
                                : activeTab.mode === 'diff'
                                ? t('git.diffReadOnly')
                                : activeTab.dirty
                                  ? t('hint.unsaved')
                                  : t('hint.saved'),
                            ),
                            h('span', { className: 'ds-spacer' }),
                            isTextMode(activeTab.mode)
                              ? h('span', { className: 'ds-status-item' }, t('status.cursor', { line: String(cursor.line), column: String(cursor.column) }))
                              : null,
                            h('span', { className: 'ds-status-item' }, t('status.encoding')),
                          ),
                        ),
                  ),
            ),
          ),
          renderFloatingChat(),
          terminalPanel,
          menu === null
            ? null
            : h(
                'div',
                { className: 'ds-menu', role: 'menu', style: { left: `${String(menu.x)}px`, top: `${String(menu.y)}px` } },
                menu.type === 'file'
                  ? h(
                      MenuItem,
                      {
                        label: t('action.open'),
                        onClick: () => {
                          setMenu(null)
                          void openFile(menu.path)
                        },
                      },
                      h(PageIcon),
                    )
                  : null,
                menu.type === 'file'
                  ? h(
                      MenuItem,
                      {
                        label: t('action.openInBrowser'),
                        onClick: () => openExternal(menu.path),
                      },
                      h(ExternalIcon),
                    )
                  : null,
                menu.type === 'file'
                  ? h(
                      MenuItem,
                      {
                        label: t('action.download'),
                        onClick: () => {
                          setMenu(null)
                          downloadFile(menu.path)
                        },
                      },
                      h(DownloadIcon),
                    )
                  : null,
                menu.type === 'file' ? h('div', { key: 'sep-open', className: 'ds-menu-sep' }) : null,
                menu.path === ''
                  ? null
                  : h(
                      MenuItem,
                      {
                        label: favoritePaths.has(menu.path) ? t('favorite.remove') : t('favorite.add'),
                        onClick: () => {
                          setMenu(null)
                          toggleFavorite(menu.path)
                        },
                      },
                      h(StarIcon, {
                        filled: favoritePaths.has(menu.path),
                        size: 14,
                        className: favoritePaths.has(menu.path) ? 'ds-star-warn' : undefined,
                      }),
                    ),
                h(
                  MenuItem,
                  {
                    label: t('action.newFileHere'),
                    onClick: () => startCreate('file', menu.type === 'directory' ? menu.path : dirname(menu.path)),
                  },
                  h(NewFileIcon),
                ),
                h(
                  MenuItem,
                  {
                    label: t('action.newFolderHere'),
                    onClick: () => startCreate('directory', menu.type === 'directory' ? menu.path : dirname(menu.path)),
                  },
                  h(NewFolderIcon),
                ),
                h(
                  MenuItem,
                  {
                    label: t('action.uploadHere'),
                    onClick: () => {
                      setMenu(null)
                      pickUploads(menu.type === 'directory' ? menu.path : dirname(menu.path))
                    },
                  },
                  h(UploadIcon),
                ),
                menu.path === ''
                  ? null
                  : h(
                      MenuItem,
                      {
                        label: t('action.copy'),
                        shortcut: 'Ctrl/⌘+C',
                        onClick: () => setClipItem('copy', menu.path, menu.type),
                      },
                      h(CopyIcon),
                    ),
                menu.path === ''
                  ? null
                  : h(
                      MenuItem,
                      {
                        label: t('action.cut'),
                        shortcut: 'Ctrl/⌘+X',
                        onClick: () => setClipItem('move', menu.path, menu.type),
                      },
                      h(CutIcon),
                    ),
                h(
                  MenuItem,
                  {
                    label: clipboard === null ? t('action.paste') : t('action.pasteHere'),
                    shortcut: 'Ctrl/⌘+V',
                    disabled: !canPasteInto(targetDirectory(menu.path, menu.type)),
                    onClick: () => void pasteInto(targetDirectory(menu.path, menu.type)),
                  },
                  h(PasteIcon),
                ),
                h('div', { key: 'sep-transfer', className: 'ds-menu-sep' }),
                menu.type === 'directory'
                  ? h(
                      MenuItem,
                      {
                        label: t('menu.refreshFolder'),
                        onClick: () => {
                          setMenu(null)
                          void loadDir(menu.path)
                        },
                      },
                      h(RefreshIcon),
                    )
                  : null,
                menu.path === ''
                  ? null
                  : h('div', { key: 'sep-edit', className: 'ds-menu-sep' }),
                menu.path === ''
                  ? null
                  : h(
                      MenuItem,
                      {
                        label: t('action.rename'),
                        shortcut: 'F2',
                        onClick: () => startRename(menu.path),
                      },
                      h(PencilIcon),
                    ),
                menu.path === ''
                  ? null
                  : h(
                      MenuItem,
                      {
                        label: t('action.delete'),
                        shortcut: 'Del',
                        danger: true,
                        onClick: () => requestDelete(menu.path),
                      },
                      h(TrashIcon),
                    ),
                h('div', { key: 'sep-copy', className: 'ds-menu-sep' }),
                h(
                  MenuItem,
                  {
                    label: t('action.copyPath'),
                    onClick: () => void copyRelative(menu.path),
                  },
                  h(CopyIcon),
                ),
                h(
                  MenuItem,
                  {
                    label: t('action.copyAbsolutePath'),
                    onClick: () => void copyAbsolute(menu.path),
                  },
                  h(CopyIcon),
                ),
              ),
          sshOpen
            ? h(
                'div',
                {
                  className: 'ds-modal-backdrop',
                  onPointerDown: (event) => {
                    if (event.target === event.currentTarget && !sshBusy) closeSshDialog()
                  },
                },
                h(
                  'div',
                  { className: 'ds-modal ds-ssh-modal', role: 'dialog', 'aria-modal': true },
                  h('div', { className: 'ds-modal-title' }, t('ssh.title')),
                  h('div', { className: 'ds-modal-text' }, t('ssh.hint')),
                  h('input', {
                    className: 'ds-ssh-input',
                    value: sshSpec,
                    placeholder: 'ssh://user@host:22/var/www',
                    spellCheck: false,
                    autoFocus: true,
                    disabled: sshBusy,
                    onChange: (event) => {
                      setSshSpec(event.target.value)
                      setSshError(null)
                      setSshCheck(null)
                    },
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void addSsh()
                      }
                    },
                  }),
                  h('input', {
                    className: 'ds-ssh-input ds-ssh-password',
                    type: 'password',
                    'aria-label': t('ssh.password'),
                    value: sshPassword,
                    placeholder: t('ssh.password'),
                    autoComplete: 'off',
                    spellCheck: false,
                    disabled: sshBusy,
                    onChange: (event) => {
                      setSshPassword(event.target.value)
                      setSshError(null)
                      setSshCheck(null)
                    },
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void addSsh()
                      }
                    },
                  }),
                  h('div', { className: 'ds-ssh-hint' }, t('ssh.passwordHint')),
                  sshError === null ? null : h('div', { className: 'ds-errorline' }, sshError),
                  sshCheck === null
                    ? null
                    : h('div', { className: 'ds-ssh-ok' }, t('ssh.checked', { name: sshCheck })),
                  h(
                    'div',
                    { className: 'ds-modal-actions' },
                    h(
                      'button',
                      { type: 'button', className: 'ds-btn', disabled: sshBusy, onClick: () => void testSsh() },
                      sshBusy ? t('ssh.testing') : t('ssh.test'),
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'ds-btn', disabled: sshBusy, onClick: closeSshDialog },
                      t('action.cancel'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'ds-btn ds-btn-primary',
                        disabled: sshBusy,
                        onClick: () => void addSsh(),
                      },
                      t('ssh.connect'),
                    ),
                  ),
                ),
              )
            : null,
          modal === null
            ? null
            : h(
                'div',
                {
                  className: 'ds-modal-backdrop',
                  onPointerDown: (event) => {
                    if (event.target === event.currentTarget) setModal(null)
                  },
                },
                h(
                  'div',
                  {
                    className: clsx(
                      'ds-modal',
                      Array.isArray(modal.commands) && modal.commands.length > 0 ? 'ds-modal-wide' : undefined,
                    ),
                    role: 'dialog',
                    'aria-modal': true,
                  },
                  h('div', { className: 'ds-modal-title' }, modal.title),
                  h('div', { className: 'ds-modal-text' }, modal.message),
                  typeof modal.code === 'string' && modal.code.length > 0
                    ? h('pre', { className: 'ds-modal-code' }, modal.code)
                    : null,
                  Array.isArray(modal.commands) && modal.commands.length > 0
                    ? h(
                        'div',
                        { className: 'ds-modal-commands' },
                        modal.commands.map((item, index) =>
                          h(
                            'div',
                            { key: index, className: 'ds-modal-command' },
                            h('div', { className: 'ds-modal-command-label' }, item.label),
                            h(
                              'div',
                              { className: 'ds-modal-command-row' },
                              h('code', { className: 'ds-modal-command-code' }, item.command),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'ds-btn ds-modal-command-copy',
                                  onClick: () => {
                                    if (typeof navigator.clipboard?.writeText !== 'function') return
                                    void navigator.clipboard.writeText(item.command).catch(() => {})
                                  },
                                },
                                t('harness.copy'),
                              ),
                            ),
                          ),
                        ),
                      )
                    : null,
                  h(
                    'div',
                    { className: 'ds-modal-actions' },
                    modal.onUpdate === undefined
                      ? null
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'ds-btn ds-btn-primary',
                            disabled: updateBusy,
                            onClick: modal.onUpdate,
                          },
                          modal.updateLabel ?? t('version.updateNow'),
                        ),
                    modal.link === undefined
                      ? null
                      : h(
                          'a',
                          {
                            className: 'ds-modal-link',
                            href: modal.link,
                            target: '_blank',
                            rel: 'noreferrer',
                          },
                          modal.linkLabel ?? modal.link,
                        ),
                    h(
                      'button',
                      { type: 'button', className: 'ds-btn', onClick: () => setModal(null) },
                      t('action.cancel'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: clsx(
                          'ds-btn',
                          modal.danger ? 'ds-btn-danger' : modal.onUpdate === undefined ? 'ds-btn-primary' : undefined,
                        ),
                        onClick: modal.onConfirm,
                      },
                      modal.confirmLabel,
                    ),
                  ),
                ),
              ),
          renderAgentModal(),
          renderPalette(),
          toast === null ? null : h('div', { className: 'ds-toast', role: 'status' }, toast),
        )
      }
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS = `
.ds-root {
  --ds-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.45;
}
.ds-root[data-maximized="true"] .ds-side,
.ds-root[data-maximized="true"] .ds-splitter { display: none; }
.ds-root *, .ds-root *::before, .ds-root *::after { box-sizing: border-box; }
.ds-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  height: 44px;
  padding: 0 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  min-width: 0;
}
.ds-header-title { display: flex; align-items: center; gap: 7px; font-weight: 600; white-space: nowrap; }
.ds-header-logo { display: inline-flex; }
.ds-version {
  flex: 0 0 auto;
  padding: 1px 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-caption);
  font: inherit;
  font-size: 10px;
  line-height: 16px;
  cursor: pointer;
}
.ds-version:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.ds-version[data-busy="true"] { opacity: 0.6; }
.ds-version[data-update="true"] { color: var(--dsw-alias-state-success-primary); border-color: currentColor; }
.ds-root[data-compact="true"] .ds-header-title > span:last-child { display: none; }
.ds-root[data-compact="true"] .ds-workspace-wrap { flex-basis: 132px; max-width: 132px; }
.ds-root[data-compact="true"] .ds-breadcrumb { padding-left: 4px; }
.ds-root[data-compact="true"] .ds-crumb { max-width: 92px; }
.ds-vr { width: 1px; height: 18px; background: var(--dsw-alias-border-l1); flex: 0 0 auto; }
.ds-workspace-wrap { position: relative; flex: 0 1 250px; min-width: 0; max-width: 340px; }
.ds-workspace-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 7px 0 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.ds-workspace-btn:hover { border-color: var(--dsw-alias-border-l2); }
.ds-workspace-btn:focus-visible { border-color: var(--dsw-alias-brand-primary); outline: none; }
.ds-workspace-btn-title { flex: 0 0 auto; max-width: 46%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.ds-workspace-btn-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: 10.5px; direction: rtl; text-align: left; }
.ds-workspace-btn .ds-chevron { flex: 0 0 auto; }
.ds-workspace-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1400;
  width: 300px;
  max-width: calc(100vw - 24px);
  max-height: min(360px, 60vh);
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);
}
.ds-ws-row { display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 6px; }
.ds-ws-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ds-ws-row[data-active="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
.ds-ws-pick {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  padding: 4px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ds-ws-pick:focus-visible { box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary); outline: none; }
.ds-ws-title { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; }
.ds-ws-path { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: 10.5px; direction: rtl; }
.ds-ws-check { flex: 0 0 auto; padding: 0 2px; color: var(--dsw-alias-brand-primary); font-size: 12px; }
.ds-ws-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  opacity: 0.55;
}
.ds-ws-row:hover .ds-ws-remove, .ds-ws-row:focus-within .ds-ws-remove { opacity: 1; }
.ds-ws-remove:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); color: var(--dsw-alias-state-error-primary); }
.ds-ws-remove:disabled { opacity: 0.2; cursor: default; }
.ds-ws-add {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  font-size: 11.5px;
  text-align: left;
  cursor: pointer;
}
.ds-ws-add:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.ds-ws-add svg { flex: 0 0 auto; width: 13px; height: 13px; }
.ds-workspace-empty { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ds-address-wrap {
  display: flex;
  align-items: center;
  flex: 1 1 220px;
  min-width: 90px;
  max-width: 460px;
  height: 28px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  overflow: hidden;
}
.ds-address-wrap:focus-within { border-color: var(--dsw-alias-brand-primary); }
.ds-address {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.ds-address::placeholder { color: var(--dsw-alias-label-secondary); }
.ds-address-go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: 4px;
  min-width: 48px;
  height: 100%;
  padding: 0 8px;
  border: 0;
  border-left: 1px solid var(--dsw-alias-border-l1);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  white-space: nowrap;
  cursor: pointer;
}
.ds-address-go:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent);
  color: var(--dsw-alias-label-primary);
}
.ds-address-go:disabled { opacity: 0.35; cursor: default; }
.ds-go-label { white-space: nowrap; }
.ds-root[data-compact="true"] .ds-address-go { min-width: 28px; padding: 0 6px; }
.ds-root[data-compact="true"] .ds-go-label { display: none; }
.ds-root[data-compact="true"] .ds-header-new { display: none; }
.ds-root[data-compact="true"] .ds-address-wrap { flex-basis: 120px; min-width: 64px; }
.ds-root[data-compact="true"] .ds-header {
  flex-wrap: wrap;
  height: auto;
  min-height: 44px;
  padding: 6px 8px;
  row-gap: 5px;
}
.ds-root[data-compact="true"] .ds-version,
.ds-root[data-compact="true"] .ds-header-root,
.ds-root[data-compact="true"] .ds-header-refresh { display: none; }
.ds-root[data-compact="true"] .ds-header-title { flex: 0 0 auto; }
.ds-root[data-compact="true"] .ds-workspace-wrap { flex: 1 1 120px; max-width: none; }
.ds-root[data-compact="true"] .ds-address-wrap {
  order: 20;
  flex: 1 1 100%;
  width: 100%;
  max-width: none;
}
.ds-root[data-compact="true"] .ds-spacer { display: none; }
.ds-root[data-compact="true"] .ds-edit-toolbar {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.ds-root[data-compact="true"] .ds-edit-toolbar::-webkit-scrollbar { display: none; }
.ds-root[data-compact="true"] .ds-breadcrumb { overflow-x: auto; scrollbar-width: none; }
.ds-root[data-compact="true"] .ds-row { height: 30px; }
.ds-root[data-compact="true"] .ds-side-tab { height: 32px; }
.ds-root[data-compact="true"] .ds-pane-actions .ds-iconbtn { width: 30px; height: 30px; }
.ds-root[data-compact="true"] .ds-terminal-quick { flex-wrap: wrap; }
.ds-root[data-compact="true"] .ds-terminal-command-select { flex-basis: 100%; max-width: none; }
.ds-root[data-compact="true"] .ds-modal-backdrop { padding: 12px; align-items: flex-start; }
.ds-root[data-compact="true"] .ds-modal { max-height: calc(100vh - 24px); overflow: auto; }
.ds-root[data-compact="true"] .ds-palette-backdrop { padding: 8px; align-items: flex-start; }
.ds-root[data-compact="true"] .ds-palette { max-height: calc(100% - 16px); }
.ds-root[data-compact="true"] .ds-toast { max-width: calc(100% - 24px); white-space: normal; }
.ds-spacer { flex: 1 1 auto; }
.ds-vspacer { flex: 0 0 4px; }
.ds-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.ds-iconbtn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent);
  color: var(--dsw-alias-label-primary);
}
.ds-iconbtn:disabled { opacity: 0.35; cursor: default; }
.ds-iconbtn-sm { width: 22px; height: 22px; }
.ds-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 7px 10px 7px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  font-size: 12px;
}
.ds-banner[data-kind="error"] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, var(--dsw-alias-bg-base)); }
.ds-banner[data-kind="warn"] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, var(--dsw-alias-bg-base)); }
.ds-banner-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.ds-banner-close { margin-left: auto; }
.ds-body { display: flex; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.ds-body[data-side="right"] .ds-side { order: 2; border-right: 0; border-left: 1px solid var(--dsw-alias-border-l1); }
.ds-body[data-side="right"] .ds-main { order: 0; }
.ds-side { order: 0; }
.ds-splitter { order: 1; }
.ds-main { order: 2; }
.ds-side {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 0;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.ds-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  height: 32px;
  padding: 0 6px 0 13px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.ds-pane-title { display: flex; align-items: center; gap: 2px; min-width: 0; }
.ds-pane-title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-pane-title .ds-side-switch { width: 20px; height: 20px; margin-left: 1px; }
.ds-pane-actions { display: flex; align-items: center; gap: 1px; flex: 0 0 auto; }
.ds-pane-actions .ds-iconbtn[data-active="true"] { color: var(--dsw-alias-brand-primary); }
.ds-pane-head > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-tree { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 2px 0 10px; outline: none; }
.ds-favorites { flex: 0 0 auto; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ds-favorites-head {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 6px 0 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
  outline: none;
}
.ds-favorites-head:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
.ds-favorites-head:focus-visible { box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.ds-favorites-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-favorites-count {
  flex: 0 0 auto;
  min-width: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 9.5px;
  line-height: 15px;
  text-align: center;
}
.ds-star-ink { display: inline-flex; color: var(--dsw-alias-state-warn-primary); }
.ds-star-warn { color: var(--dsw-alias-state-warn-primary); }
.ds-favorites-list { max-height: 200px; overflow: auto; padding: 1px 0 6px; }
.ds-fav-row {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 5px 0 12px;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  outline: none;
}
.ds-fav-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ds-fav-row:focus-visible { box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.ds-fav-row[data-active="true"] .ds-fav-name { color: var(--dsw-alias-brand-primary); }
.ds-fav-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-fav-path {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  text-align: right;
}
.ds-fav-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  opacity: 0;
}
.ds-fav-row:hover .ds-fav-remove, .ds-fav-row:focus-within .ds-fav-remove { opacity: 1; }
.ds-fav-remove:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent); color: var(--dsw-alias-label-primary); }
.ds-fav-empty { padding: 3px 12px 7px; color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 1.55; }
.ds-fav-mark { display: inline-flex; flex: 0 0 auto; margin-left: 1px; }
.ds-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding-right: 8px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  color: var(--dsw-alias-label-primary);
  outline: none;
}
.ds-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ds-row:focus-visible { box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.ds-row[data-selected="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 15%, transparent); }
.ds-row[data-selected="true"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 2px;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary);
}
.ds-row[data-active="true"] .ds-name { color: var(--dsw-alias-brand-primary); }
.ds-row[data-cut="true"] { opacity: 0.5; }
.ds-row[data-drop="true"],
.ds-tree[data-drop="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
}
.ds-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  color: var(--dsw-alias-label-secondary);
  transition: transform 120ms ease;
}
.ds-chevron[data-open="true"] { transform: rotate(90deg); }
.ds-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ds-tag { margin-left: auto; color: var(--dsw-alias-label-secondary); font-size: 10px; }
.ds-glyph { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.ds-glyph-folder { color: var(--dsw-alias-state-warn-primary); }
.ds-glyph-pdf, .ds-fileglyph-pdf { color: var(--dsw-alias-state-error-primary); }
.ds-glyph-image, .ds-fileglyph-image { color: var(--dsw-alias-state-success-primary); }
.ds-glyph-markdown, .ds-fileglyph-markdown { color: var(--dsw-alias-brand-primary); }
.ds-glyph-code, .ds-fileglyph-code { color: var(--dsw-alias-brand-primary); }
.ds-glyph-web, .ds-fileglyph-web { color: var(--dsw-alias-state-warn-primary); }
.ds-glyph-data, .ds-fileglyph-data { color: var(--dsw-alias-state-warn-primary); }
.ds-glyph-plain, .ds-fileglyph-plain { color: var(--dsw-alias-label-secondary); }
.ds-rowinput {
  flex: 1 1 auto;
  min-width: 0;
  height: 21px;
  padding: 0 4px;
  border: 1px solid var(--dsw-alias-brand-primary);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  outline: none;
}
.ds-row-draft { padding-right: 6px; }
.ds-hint { padding: 5px 13px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ds-errorline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 13px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.ds-linkbtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
}
.ds-linkbtn:hover { text-decoration: underline; }
.ds-side[data-view="git"] .ds-favorites,
.ds-side[data-view="git"] .ds-tree,
.ds-side[data-view="git"] > .ds-hint,
.ds-side[data-view="git"] > .ds-empty { display: none; }
.ds-side[data-view="git"] .ds-pane-actions .ds-iconbtn:not(.ds-side-switch) { display: none; }
.ds-side[data-view="search"] .ds-pane-actions .ds-iconbtn:not(.ds-side-switch),
.ds-side[data-view="harness"] .ds-pane-actions .ds-iconbtn:not(.ds-side-switch) { display: none; }
.ds-git-toggle[data-active="true"] {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.ds-git { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; }
.ds-git-viewtabs {
  display: flex;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-viewtab {
  flex: 1 1 0;
  height: 26px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
}
.ds-git-viewtab:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ds-git-viewtab[data-active="true"] {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
  box-shadow: inset 0 -2px 0 var(--dsw-alias-brand-primary);
}
.ds-git-history { flex: 1 1 auto; min-height: 0; overflow: auto; }
.ds-git-history-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 120px; padding: 18px; color: var(--dsw-alias-label-secondary); font-size: 12px; text-align: center; }
.ds-git-graph { padding-bottom: 12px; }
.ds-git-graph-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--dsw-alias-bg-layer-1);
}
.ds-git-graph-head .ds-git-section-title { flex: 1 1 auto; padding: 0; }
.ds-git-graph-entry { border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 55%, transparent); }
.ds-git-graph-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 4px 6px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ds-git-graph-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ds-git-graph-row[data-active="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.ds-git-graph-prefix {
  flex: 0 0 auto;
  white-space: pre;
  color: var(--dsw-alias-brand-primary);
  font-family: var(--ds-mono);
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.85;
}
.ds-git-graph-only {
  white-space: pre;
  padding: 0 6px;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-mono);
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.7;
}
.ds-git-graph-body { display: flex; flex: 1 1 auto; flex-direction: column; gap: 1px; min-width: 0; }
.ds-git-graph-subject { overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.ds-git-graph-meta { overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.ds-git-graph-refs { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 1px; }
.ds-git-graph-refs .ds-git-tag { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9.5px; }
.ds-git-commit-detail {
  margin: 2px 6px 7px 12px;
  padding: 6px 8px;
  border-left: 2px solid var(--dsw-alias-brand-primary);
  border-radius: 0 5px 5px 0;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent);
}
.ds-git-commit-detail-head { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.ds-git-commit-detail-hash { flex: 0 0 auto; color: var(--dsw-alias-brand-primary); font-family: var(--ds-mono); font-size: 10.5px; }
.ds-git-commit-detail-subject { min-width: 0; overflow: hidden; font-size: 11.5px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.ds-git-commit-detail-meta { margin-top: 2px; color: var(--dsw-alias-label-secondary); font-size: 10px; }
.ds-git-commit-files { display: flex; flex-direction: column; gap: 1px; margin-top: 6px; }
.ds-git-commit-file {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 2px 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.ds-git-commit-file:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.ds-git-commit-file-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-git-commit-file-old { flex: 0 0 auto; max-width: 42%; overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }
.ds-git-file-status { flex: 0 0 14px; color: var(--dsw-alias-label-secondary); font-family: var(--ds-mono); font-size: 10px; text-align: center; }
.ds-git-file-status[data-status="A"] { color: var(--dsw-alias-state-success-primary); }
.ds-git-file-status[data-status="D"] { color: var(--dsw-alias-state-error-primary); }
.ds-git-file-status[data-status="M"] { color: var(--dsw-alias-state-warn-primary); }
.ds-git-file-status[data-status="R"] { color: var(--dsw-alias-brand-primary); }
.ds-git-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 4px 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-toolbar {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  padding: 4px 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-toolbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1 1 0;
  min-width: 0;
  height: 24px;
  padding: 0 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ds-git-toolbtn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
}
.ds-git-toolbtn[data-active="true"] {
  color: var(--dsw-alias-brand-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
}
.ds-git-toolbtn:disabled { opacity: 0.38; cursor: default; }
.ds-git-toolbtn svg { flex: 0 0 auto; width: 12px; height: 12px; }
.ds-git-toolbtn-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ds-git-toolcount {
  flex: 0 0 auto;
  min-width: 13px;
  padding: 0 3px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  line-height: 13px;
  text-align: center;
}
.ds-git-branch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 65%;
  height: 24px;
  padding: 0 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ds-git-branch:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.ds-git-branch svg { flex: 0 0 auto; }
.ds-git-branch-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-git-upstream {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
}
.ds-git-count, .ds-git-tag {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 9.5px;
  white-space: nowrap;
}
.ds-git-tag { color: var(--dsw-alias-state-warn-primary); }
.ds-git-commit {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 5px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-message {
  width: 100%;
  min-height: 52px;
  max-height: 140px;
  padding: 6px 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}
.ds-git-message:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-git-message::placeholder { color: var(--dsw-alias-label-secondary); }
.ds-git-commit-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ds-git-commit-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; margin-left: auto; }
.ds-git-commit-hint {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
}
.ds-git-commit-btn { height: 25px; padding: 0 10px; font-size: 11.5px; }
.ds-git-commit-btn:disabled { opacity: 0.4; cursor: default; }
.ds-git-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; padding-bottom: 8px; }
.ds-git-section { border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 3px; }
.ds-git-section:last-child { border-bottom: 0; }
.ds-git-section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 25px;
  padding: 2px 8px;
}
.ds-git-section-title {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ds-git-section-head .ds-linkbtn { font-size: 10.5px; }
.ds-git-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 2px 6px 2px 8px;
  cursor: pointer;
  outline: none;
}
.ds-git-row:hover, .ds-git-row:focus-visible { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.ds-git-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1;
}
.ds-git-badge[data-status="M"] { color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); }
.ds-git-badge[data-status="A"], .ds-git-badge[data-status="U"] { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); }
.ds-git-badge[data-status="D"], .ds-git-badge[data-status="!"] { color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent); }
.ds-git-badge[data-status="R"] { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
.ds-git-path {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.ds-git-row-actions { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 auto; }
.ds-git-row-action { width: 20px; height: 20px; opacity: 0.55; }
.ds-git-row:hover .ds-git-row-action, .ds-git-row:focus-within .ds-git-row-action { opacity: 1; }
.ds-git-row-action:disabled { opacity: 0.2; }
.ds-git-row-discard:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary); }
.ds-git-section-actions { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.ds-git-discard-all { color: var(--dsw-alias-state-error-primary); }
.ds-modal.ds-git-stash-modal {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: min(86vh, 720px);
}
.ds-git-stash-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}
.ds-git-stash-save {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent);
}
.ds-git-stash-input { min-height: 44px; max-height: 90px; white-space: pre-wrap; }
.ds-git-stash-save-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ds-git-stash-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  cursor: pointer;
  user-select: none;
}
.ds-git-stash-option input { margin: 0; accent-color: var(--dsw-alias-brand-primary); }
.ds-git-stash-save-btn { height: 26px; margin-left: auto; padding: 0 10px; font-size: 11.5px; }
.ds-git-stash-save-btn:disabled { opacity: 0.4; cursor: default; }
.ds-git-stash-save-hint { padding: 0; font-size: 10.5px; }
.ds-git-stash-listhead {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  padding-top: 9px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-stash-list { display: flex; flex-direction: column; gap: 3px; }
.ds-git-stash-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
}
.ds-git-stash-item:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
.ds-git-stash-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }
.ds-git-stash-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.ds-git-stash-ref { flex: 0 0 auto; color: var(--dsw-alias-brand-primary); font-family: var(--ds-mono); font-size: 10.5px; }
.ds-git-stash-message { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.ds-git-stash-meta { color: var(--dsw-alias-label-secondary); font-size: 10px; }
.ds-git-stash-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.ds-git-stash-actions .ds-linkbtn { font-size: 10.5px; }
.ds-git-stash-drop { width: 22px; height: 22px; opacity: 0.55; }
.ds-git-stash-drop:hover:not(:disabled) { opacity: 1; color: var(--dsw-alias-state-error-primary); }
.ds-git-stash-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
}
.ds-git-hint { padding: 6px 9px; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.ds-git-empty {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 22px 16px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  overflow: auto;
}
.ds-git-empty-title { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; }
.ds-git-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
  color: var(--dsw-alias-state-error-primary);
  font-size: 11.5px;
  overflow-wrap: anywhere;
}
.ds-git-error-text { flex: 1 1 auto; }
.ds-git-diff-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-diff-title {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.ds-git-diff-tag {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
}
.ds-git-diff-modes {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  padding: 2px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
}
.ds-git-diff-mode {
  height: 20px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ds-git-diff-mode:hover { color: var(--dsw-alias-label-primary); }
.ds-git-diff-mode[data-active="true"] {
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);
}
.ds-diffview { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow: hidden; }
.ds-diffview .ds-git-diff-code { min-height: 0; }
.ds-git-diff-hscroll {
  flex: 0 0 auto;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--dsw-alias-bg-layer-1);
}
.ds-git-diff-hscroll-inner { height: 1px; }
.ds-glyph-diff { color: var(--dsw-alias-brand-primary); }
.ds-tab-tag {
  flex: 0 0 auto;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-size: 9.5px;
}
.ds-git-diff-split-scroll {
  flex: 1 1 auto;
  min-height: 160px;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-mono);
  font-size: 12px;
  line-height: 1.55;
}
.ds-git-diff-note {
  padding: 6px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}
.ds-git-split { width: 100%; border-collapse: collapse; table-layout: fixed; }
.ds-git-split thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 4px 10px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: left;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-split thead th:first-child { border-right: 1px solid var(--dsw-alias-border-l1); }
.ds-git-split td { padding: 0; vertical-align: top; }
.ds-git-split-new { border-left: 1px solid var(--dsw-alias-border-l1); }
.ds-git-split-clip { display: flex; align-items: stretch; width: 100%; overflow: hidden; }
.ds-git-split-ln {
  flex: 0 0 52px;
  width: 52px;
  padding: 0 7px 0 4px;
  box-sizing: border-box;
  text-align: right;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  user-select: none;
}
.ds-git-split-codebox { flex: 1 1 auto; min-width: 0; overflow: hidden; }
.ds-git-split-code {
  display: inline-block;
  width: max-content;
  padding: 0 12px 0 2px;
  white-space: pre;
  tab-size: 2;
  transform: translateX(calc(-1 * var(--ds-diff-scroll, 0px)));
}
.ds-git-split-row[data-kind="del"] .ds-git-split-old:not(.ds-git-split-empty),
.ds-git-split-row[data-kind="change"] .ds-git-split-old:not(.ds-git-split-empty) {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 11%, transparent);
}
.ds-git-split-row[data-kind="add"] .ds-git-split-new:not(.ds-git-split-empty),
.ds-git-split-row[data-kind="change"] .ds-git-split-new:not(.ds-git-split-empty) {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 11%, transparent);
}
.ds-git-split-empty {
  background: repeating-linear-gradient(
    135deg,
    transparent 0 5px,
    color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent) 5px 6px
  );
}
.ds-git-split-old .ds-git-split-emph {
  border-radius: 2px;
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 24%, transparent);
}
.ds-git-split-new .ds-git-split-emph {
  border-radius: 2px;
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 24%, transparent);
}
.ds-git-split-hunk td {
  padding: 3px 10px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
}
.ds-git-split-meta td {
  padding: 2px 10px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
}
.ds-git-diff-code {
  flex: 1 1 auto;
  min-height: 160px;
  margin: 0;
  overflow: auto;
  padding: 12px 14px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre;
  tab-size: 2;
}
.ds-git-upstream { display: none; }
.ds-modal.ds-git-branch-modal { width: min(420px, 100%); }
.ds-git-branch-list { max-height: 300px; overflow: auto; margin: 8px 0; }
.ds-git-branch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.ds-git-branch-item:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.ds-git-branch-item[data-current="true"] { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.ds-git-branch-item-name { min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-git-branch-check { color: var(--dsw-alias-brand-primary); font-size: 13px; }
.ds-modal.ds-git-compare-modal {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  max-height: 86vh;
  padding: 0;
  overflow: hidden;
}
.ds-git-compare-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
  overflow: auto;
  padding: 10px 14px 14px;
}
.ds-git-compare-controls { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.ds-git-compare-label { flex: 0 0 auto; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.ds-git-select {
  min-width: 0;
  flex: 1 1 auto;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.ds-git-select:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-git-compare-result { display: flex; flex-direction: column; gap: 10px; }
.ds-git-compare-summary { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ds-git-compare-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.ds-git-compare-section .ds-git-section-title {
  flex: 0 0 auto;
  padding: 0 2px 4px;
  font-size: 10.5px;
}
.ds-git-commit-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 2px 6px;
  font-size: 11.5px;
}
.ds-git-commit-hash { flex: 0 0 auto; color: var(--dsw-alias-brand-primary); font-family: var(--ds-mono); font-size: 10.5px; }
.ds-git-commit-subject {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-git-commit-meta {
  flex: 0 0 auto;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
}
.ds-git-compare-file { cursor: pointer; }
.ds-git-compare-file[data-busy="true"] { opacity: 0.55; }
.ds-git-compare-busy { flex: 0 0 auto; padding: 0; font-size: 10px; }
.ds-side-view { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow: hidden; }
.ds-side-tabs {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.ds-side-tab {
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  height: 26px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
}
.ds-side-tab:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ds-side-tab[data-active="true"] {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
  box-shadow: inset 0 2px 0 var(--dsw-alias-brand-primary);
}
.ds-side-tab svg { flex: 0 0 auto; width: 12px; height: 12px; }
.ds-side-tab span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-toggle {
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-caption);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.ds-toggle[data-active="true"] {
  color: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.ds-search-form { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ds-search-input {
  flex: 1 1 120px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  outline: none;
}
.ds-search-input:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-search-run {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.ds-search-run:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.ds-search-options { display: flex; align-items: center; gap: 6px; width: 100%; }
.ds-search-meta { font-size: 10px; color: var(--dsw-alias-label-caption); white-space: nowrap; }
.ds-search-results { flex: 1 1 auto; min-height: 0; overflow: auto; }
.ds-search-file { border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 4px; }
.ds-search-file-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px 2px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  text-align: left;
  cursor: pointer;
}
.ds-search-file-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-search-file-count { margin-left: auto; color: var(--dsw-alias-label-caption); font-size: 10px; }
.ds-search-file-path { padding: 0 8px 2px 28px; font-size: 10px; color: var(--dsw-alias-label-caption); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-search-hit {
  display: flex;
  gap: 8px;
  width: 100%;
  padding: 2px 8px 2px 12px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ds-search-hit:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.ds-search-line { flex: 0 0 30px; text-align: right; color: var(--dsw-alias-label-caption); font-family: var(--ds-mono); font-size: 10px; }
.ds-search-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre; font-family: var(--ds-mono); font-size: 10.5px; }
.ds-harness-view { overflow: auto; }
.ds-harness-section { padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ds-harness-label { margin: 2px 0 3px; color: var(--dsw-alias-label-caption); font-size: 9.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.ds-harness-value { color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 600; }
.ds-harness-path { margin-top: 2px; color: var(--dsw-alias-label-caption); font-family: var(--ds-mono); font-size: 10px; word-break: break-all; }
.ds-harness-item { padding: 1px 0; color: var(--dsw-alias-label-secondary); font-family: var(--ds-mono); font-size: 10.5px; word-break: break-all; }
.ds-harness-file {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.ds-harness-file:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); color: var(--dsw-alias-label-primary); }
.ds-harness-check { width: 100%; }
.ds-harness-check-result { margin-top: 8px; }
.ds-harness-ok { color: var(--dsw-alias-state-success-primary); font-size: 11px; font-weight: 600; }
.ds-harness-fail { color: var(--dsw-alias-state-danger-primary); font-size: 11px; font-weight: 600; }
.ds-harness-output {
  max-height: 240px;
  margin: 6px 0 0;
  padding: 7px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-mono);
  font-size: 10px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.ds-harness-config-head { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ds-harness-config-name { min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--ds-mono); font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.ds-harness-config {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 8px;
  overflow: auto;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-mono);
  font-size: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.ds-editor-shell { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; }
.ds-findbar {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.ds-find-input {
  flex: 1 1 150px;
  min-width: 80px;
  height: 26px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  outline: none;
}
.ds-find-input:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-find-input.ds-find-replace { flex: 1 1 120px; }
.ds-find-count { flex: 0 0 auto; min-width: 42px; color: var(--dsw-alias-label-caption); font-size: 10px; text-align: center; }
.ds-find-btn {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.ds-find-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.ds-find-btn:disabled { opacity: 0.45; cursor: default; }
.ds-find-action { font-size: 10px; }
.ds-palette-backdrop {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 10vh 12px 12px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 55%, transparent);
}
.ds-palette {
  display: flex;
  flex-direction: column;
  width: min(620px, 100%);
  max-height: 72%;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 18px 60px color-mix(in srgb, #000 28%, transparent);
}
.ds-palette-title { padding: 7px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-caption); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.ds-palette-input {
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.ds-palette-list { flex: 1 1 auto; min-height: 0; padding: 4px; overflow: auto; }
.ds-palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.ds-palette-item[data-active="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); color: var(--dsw-alias-label-primary); }
.ds-palette-item-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-palette-item-path { margin-left: auto; min-width: 0; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-caption); font-family: var(--ds-mono); font-size: 10px; }
.ds-palette-hint { flex: 0 0 auto; padding: 6px 12px; border-top: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-caption); font-size: 10px; }
.ds-terminal-toggle[data-active="true"] { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
.ds-glyph-terminal { color: var(--dsw-alias-brand-primary); }
.ds-glyph-terminal svg { width: 14px; height: 14px; }
.ds-terminal-panel {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 120px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}
.ds-terminal-resize {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  height: 5px;
  cursor: row-resize;
}
.ds-terminal-resize:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent); }
.ds-terminal-tabs {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 2px;
  min-height: 28px;
  padding: 0 4px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  overflow-x: auto;
}
.ds-terminal-tab {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  max-width: 180px;
  height: 24px;
  border-radius: 5px;
  color: var(--dsw-alias-label-secondary);
}
.ds-terminal-tab[data-active="true"] { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.ds-terminal-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 100%;
  padding: 0 3px 0 7px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ds-terminal-tab-btn svg { flex: 0 0 auto; width: 13px; height: 13px; }
.ds-terminal-tab-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-terminal-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.ds-terminal-tab-close:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); }
.ds-terminal-tab-dot { flex: 0 0 auto; width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); }
.ds-terminal-empty { display: flex; flex: 1; align-items: center; justify-content: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ds-terminal-view { position: relative; display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; background: var(--dsw-alias-bg-base); }
.ds-terminal-quick {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 4px 5px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.ds-terminal-command-select {
  flex: 0 1 190px;
  min-width: 0;
  height: 24px;
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
}
.ds-terminal-quick-empty { flex: 0 0 auto; max-width: 190px; color: var(--dsw-alias-label-caption); font-size: 10px; }
.ds-terminal-command-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-mono);
  font-size: 10.5px;
  outline: none;
}
.ds-terminal-command-input:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-terminal-command-refresh {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.ds-terminal-command-refresh:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.ds-terminal-command-run {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.ds-terminal-command-run:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.ds-terminal-command-run:disabled { opacity: 0.4; cursor: default; }
.ds-terminal-host { flex: 1 1 auto; min-height: 0; padding: 3px 4px; overflow: hidden; }
.ds-terminal-host .xterm { height: 100%; }
.ds-terminal-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 82%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  pointer-events: none;
}
.ds-terminal-overlay.ds-terminal-error { color: var(--dsw-alias-state-error-primary); pointer-events: auto; }
.ds-terminal-exited {
  position: absolute;
  right: 8px;
  bottom: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, var(--dsw-alias-bg-overlay));
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  pointer-events: none;
}
.ds-terminal-toolbar .ds-lang { font-family: var(--ds-mono); }
.ds-side-foot {
  flex: 0 0 auto;
  padding: 5px 10px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
}
.ds-side-path { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
.ds-splitter { flex: 0 0 auto; width: 5px; margin: 0 -2px; cursor: col-resize; z-index: 3; }
.ds-splitter:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent); }
.ds-main { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; min-height: 0; background: var(--dsw-alias-bg-base); }
.ds-tabs {
  display: flex;
  flex: 0 0 auto;
  height: 35px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  scrollbar-width: none;
}
.ds-tabs::-webkit-scrollbar { display: none; }
.ds-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  max-width: 230px;
  min-width: 90px;
  padding: 0 5px 0 11px;
  border-right: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.ds-tab:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
.ds-tab[data-active="true"] { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
.ds-tab[data-active="true"]::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: var(--dsw-alias-brand-primary);
}
.ds-tab-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-tabclose {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  opacity: 0;
}
.ds-tab:hover .ds-tabclose, .ds-tab[data-active="true"] .ds-tabclose { opacity: 1; }
.ds-tabclose:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent); color: var(--dsw-alias-label-primary); }
.ds-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-brand-primary); }
.ds-breadcrumb {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  height: 32px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  overflow: hidden;
}
.ds-breadcrumb-root { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: var(--dsw-alias-label-secondary); flex: 0 0 auto; }
.ds-crumb-sep { color: var(--dsw-alias-border-l2); flex: 0 0 auto; }
.ds-crumb-diff {
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-crumb {
  padding: 2px 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.ds-crumb:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-primary); }
.ds-edit-toolbar { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; margin-left: 8px; }
.ds-switch { display: inline-flex; padding: 2px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); }
.ds-switch-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.ds-switch-btn[data-active="true"] { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); box-shadow: 0 0 0 1px var(--dsw-alias-border-l1); }
.ds-wrap-toggle { flex: 0 0 auto; }
.ds-wrap-toggle svg { flex: 0 0 auto; }
.ds-wrap-label { white-space: nowrap; }
.ds-root[data-compact="true"] .ds-wrap-label { display: none; }
.ds-toolbtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  height: 22px;
  padding: 0 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.ds-toolbtn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
  color: var(--dsw-alias-label-primary);
}
.ds-toolbtn:disabled { opacity: 0.4; cursor: default; }
.ds-toolbtn svg { flex: 0 0 auto; }
.ds-tool-label { white-space: nowrap; }
.ds-root[data-compact="true"] .ds-tool-label { display: none; }
.ds-lang { color: var(--dsw-alias-label-secondary); font-size: 11px; white-space: nowrap; }
.ds-savebtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.ds-savebtn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.ds-savebtn:disabled { opacity: 0.4; cursor: default; }
.ds-dirty-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-brand-primary); }
.ds-md-split-wrap { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; min-height: 0; }
.ds-md-split-bar { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }
.ds-md-split-label { color: var(--dsw-alias-label-caption); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.ds-md-split { display: grid; flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden; }
.ds-md-split[data-stacked="true"] { display: flex; flex-direction: column; }
.ds-md-split-pane { display: flex; min-width: 0; min-height: 0; overflow: hidden; }
.ds-md-split-editor { background: var(--dsw-alias-bg-base); }
.ds-md-split-preview { background: var(--dsw-alias-bg-base); }
.ds-md-split-preview .ds-md { flex: 1 1 auto; min-height: 0; padding: 18px 22px 50px; }
.ds-md-split-preview .ds-md-inner { max-width: none; }
.ds-md-split-divider {
  position: relative;
  z-index: 2;
  cursor: col-resize;
  touch-action: none;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}
.ds-md-split-divider::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  background: var(--dsw-alias-border-l1);
}
.ds-md-split-divider:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }
.ds-md-split[data-stacked="true"] .ds-md-split-divider { display: none; }
.ds-md-split[data-stacked="true"] .ds-md-split-editor,
.ds-md-split[data-stacked="true"] .ds-md-split-preview { flex: 1 1 50%; }
.ds-md-split[data-stacked="true"] .ds-md-split-preview { border-top: 1px solid var(--dsw-alias-border-l1); }
.ds-editor-wrap { display: flex; flex: 1 1 auto; min-height: 0; position: relative; }
.ds-gutter {
  flex: 0 0 auto;
  width: 56px;
  overflow: hidden;
  position: relative;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
}
.ds-gutter-inner {
  position: absolute;
  inset: 0 0 auto 0;
  padding: 12px 0;
  font-family: var(--ds-mono);
  font-size: 12px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  text-align: right;
}
.ds-gutter-line { height: 20px; padding-right: 11px; }
.ds-code-area { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden; }
.ds-code-area[data-wrap="true"] .ds-pre,
.ds-code-area[data-wrap="true"] .ds-ta {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-all;
  overflow-x: hidden;
}
.ds-code-area[data-wrap="true"] .ds-ta { scrollbar-gutter: stable; }
.ds-code-area[data-wrap="true"] .ds-pre { padding-right: 26px; }
.ds-pre, .ds-ta {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 12px 16px;
  border: 0;
  font-family: var(--ds-mono);
  font-size: 13px;
  line-height: 20px;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  box-sizing: border-box;
}
.ds-pre { overflow: hidden; pointer-events: none; color: var(--dsw-alias-label-primary); }
.ds-ta {
  z-index: 2;
  background: transparent;
  color: transparent;
  caret-color: var(--dsw-alias-label-primary);
  resize: none;
  outline: none;
}
.ds-ta::selection { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent); }
.ds-ta::-webkit-scrollbar, .ds-tree::-webkit-scrollbar, .ds-md::-webkit-scrollbar, .ds-pre::-webkit-scrollbar { width: 10px; height: 10px; }
.ds-ta::-webkit-scrollbar-thumb, .ds-tree::-webkit-scrollbar-thumb, .ds-md::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent); border-radius: 6px; }
.ds-ta::-webkit-scrollbar-track, .ds-tree::-webkit-scrollbar-track, .ds-md::-webkit-scrollbar-track { background: transparent; }
.ds-root {
  --ds-syn-keyword: color-mix(in srgb, #2563eb 82%, var(--dsw-alias-label-primary));
  --ds-syn-string: color-mix(in srgb, #16a34a 82%, var(--dsw-alias-label-primary));
  --ds-syn-number: color-mix(in srgb, #d97706 82%, var(--dsw-alias-label-primary));
  --ds-syn-comment: color-mix(in srgb, #64748b 78%, var(--dsw-alias-label-primary));
  --ds-syn-type: color-mix(in srgb, #9333ea 82%, var(--dsw-alias-label-primary));
  --ds-syn-function: color-mix(in srgb, #0d9488 82%, var(--dsw-alias-label-primary));
  --ds-syn-property: color-mix(in srgb, #ea580c 82%, var(--dsw-alias-label-primary));
  --ds-syn-constant: color-mix(in srgb, #b45309 82%, var(--dsw-alias-label-primary));
}
.ds-tok-comment { color: var(--ds-syn-comment); font-style: italic; }
.ds-tok-keyword { color: var(--ds-syn-keyword); font-weight: 500; }
.ds-tok-string { color: var(--ds-syn-string); }
.ds-tok-number { color: var(--ds-syn-number); }
.ds-tok-constant { color: var(--ds-syn-constant); }
.ds-tok-function { color: var(--ds-syn-function); font-weight: 600; }
.ds-tok-type { color: var(--ds-syn-type); }
.ds-tok-property { color: var(--ds-syn-property); }
.ds-tok-attr { color: var(--ds-syn-property); }
.ds-tok-tag { color: var(--ds-syn-keyword); }
.ds-tok-heading { color: var(--ds-syn-type); font-weight: 600; }
.ds-tok-link { color: var(--ds-syn-keyword); text-decoration: underline; }
.ds-git-diff-code .ds-tok-keyword { color: color-mix(in srgb, #dc2626 82%, var(--dsw-alias-label-primary)); }
.ds-git-diff-code .ds-tok-string { color: color-mix(in srgb, #16a34a 82%, var(--dsw-alias-label-primary)); }
.ds-git-diff-code .ds-tok-function { color: var(--dsw-alias-label-secondary); }
.ds-statusbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 0 0 auto;
  height: 24px;
  padding: 0 10px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-specific-sidebar-fill);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
}
.ds-status-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ds-welcome { display: flex; flex: 1 1 auto; align-items: center; justify-content: center; padding: 32px; }
.ds-welcome-card { display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 460px; text-align: center; }
.ds-welcome-logo { display: inline-flex; color: var(--dsw-alias-brand-primary); margin-bottom: 2px; }
.ds-welcome-title { font-size: 19px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.ds-welcome-text { color: var(--dsw-alias-label-secondary); line-height: 1.7; }
.ds-kbdline { color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.ds-empty {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: var(--dsw-alias-label-secondary);
  text-align: center;
}
.ds-empty-title { color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 600; }
.ds-empty-text { max-width: 520px; overflow-wrap: anywhere; }
.ds-empty-actions { display: flex; align-items: center; gap: 8px; }
.ds-empty-error { color: var(--dsw-alias-state-error-primary); }
.ds-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  border-top-color: var(--dsw-alias-brand-primary);
  border-radius: 50%;
  animation: ds-spin 0.8s linear infinite;
}
@keyframes ds-spin { to { transform: rotate(360deg); } }
.ds-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.ds-btn:hover { border-color: var(--dsw-alias-border-l2); }
.ds-btn-primary { border-color: transparent; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.ds-btn-danger { border-color: transparent; background: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-bg-base); }
.ds-menu {
  position: fixed;
  z-index: 1200;
  min-width: 200px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);
}
.ds-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.ds-menu-item:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent); }
.ds-menu-item:disabled { opacity: 0.4; cursor: default; }
.ds-menu-item:disabled:hover { background: transparent; }
.ds-menu-item[data-danger="true"] { color: var(--dsw-alias-state-error-primary); }
.ds-menu-label { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; white-space: nowrap; }
.ds-menu-kbd { flex: 0 0 auto; margin-left: auto; color: var(--dsw-alias-label-secondary); font-size: 10.5px; white-space: nowrap; }
.ds-menu-sep { height: 1px; margin: 4px 3px; background: var(--dsw-alias-border-l1); }
.ds-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 30%, transparent);
}
.ds-ssh-modal { width: min(560px, 100%); }
.ds-ssh-input {
  width: 100%;
  height: 32px;
  margin-top: 8px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-mono);
  font-size: 12px;
  outline: none;
}
.ds-ssh-input:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-ssh-hint { margin-top: 6px; color: var(--dsw-alias-label-caption); font-size: 11px; line-height: 1.5; }
.ds-ssh-ok { margin-top: 8px; color: var(--dsw-alias-state-success-primary); font-size: 11.5px; }
.ds-modal {
  width: min(430px, 100%);
  padding: 18px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 24px 70px color-mix(in srgb, var(--dsw-alias-label-primary) 30%, transparent);
}
.ds-modal-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.ds-modal-text { color: var(--dsw-alias-label-secondary); line-height: 1.65; overflow-wrap: anywhere; }
.ds-modal-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.ds-modal-link { margin-right: auto; align-self: center; color: var(--dsw-alias-brand-primary); font-size: 12px; text-decoration: none; }
.ds-modal-link:hover { text-decoration: underline; }
.ds-modal-wide { width: min(680px, 100%); }
.ds-modal-code {
  max-height: 240px;
  margin: 10px 0 0;
  padding: 8px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-mono);
  font-size: 10.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.ds-modal-commands { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.ds-modal-command-label { margin-bottom: 3px; color: var(--dsw-alias-label-caption); font-size: 10px; }
.ds-modal-command-row { display: flex; align-items: stretch; gap: 6px; }
.ds-modal-command-code {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-mono);
  font-size: 10.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.ds-modal-command-copy { flex: 0 0 auto; height: auto; padding: 0 10px; font-size: 11px; }
.ds-agent-modal { width: min(720px, 100%); }
.ds-agent-context { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin-top: 10px; }
.ds-agent-path { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary); font-family: var(--ds-mono); font-size: 11px; }
.ds-agent-range { color: var(--dsw-alias-label-caption); font-size: 10.5px; }
.ds-agent-preview-wrap { margin-top: 10px; }
.ds-agent-preview-label { margin-bottom: 4px; color: var(--dsw-alias-label-caption); font-size: 10px; }
.ds-agent-preview {
  max-height: 240px;
  margin: 0;
  padding: 8px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-mono);
  font-size: 10.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.ds-agent-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.ds-agent-actions .ds-btn { flex: 1 1 140px; }
.ds-agent-btn { color: var(--dsw-alias-brand-primary); }
.ds-toast {
  position: absolute;
  left: 50%;
  bottom: 34px;
  transform: translateX(-50%);
  z-index: 1400;
  max-width: 70%;
  padding: 7px 13px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 20%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ds-browser-toolbar { gap: 4px; }
.ds-browser-address-form { display: flex; flex: 1 1 auto; min-width: 0; }
.ds-browser-address {
  width: 100%;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-mono);
  font-size: 11.5px;
  outline: none;
}
.ds-browser-address:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-glyph-browser { color: var(--dsw-alias-brand-primary); }
.ds-glyph-browser svg { width: 14px; height: 14px; }
.ds-crumb-browser {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-mono);
  font-size: 11px;
}
.ds-browser-pane { display: flex; flex: 1 1 auto; width: 100%; min-height: 0; }
.ds-browser-pane[data-active="false"] { display: none; }
.ds-browser-device-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  padding: 2px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base);
}
.ds-browser-device-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.ds-browser-device-btn svg { width: 13px; height: 13px; }
.ds-browser-device-btn[data-active="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); color: var(--dsw-alias-brand-primary); }
.ds-browser-proxy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.ds-browser-proxy-btn[data-active="true"] { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); color: var(--dsw-alias-brand-primary); }
.ds-browser-preset {
  flex: 0 0 auto;
  height: 26px;
  max-width: 106px;
  padding: 0 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 10.5px;
  outline: none;
}
.ds-browser-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}
.ds-browser-stage-mobile {
  padding: 12px;
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent), transparent 60%),
    var(--dsw-alias-bg-layer-1);
}
.ds-browser-device-wrap { position: relative; flex: 0 0 auto; }
.ds-browser-device {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  border-radius: 20px;
  outline: 6px solid #1c1c1e;
  background: #fff;
  box-shadow: 0 18px 50px color-mix(in srgb, var(--dsw-alias-label-primary) 28%, transparent);
  transform-origin: top left;
}
.ds-browser-device-pc {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 0;
  outline: none;
  box-shadow: none;
  transform: none;
}
.ds-browser-device-wrap-pc { width: 100%; height: 100%; }
.ds-browser-device-pc .ds-browser-frame { border-radius: 0; }
.ds-browser-device .ds-browser-frame { width: 100%; height: 100%; border-radius: 14px; }
.ds-browser {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-layer-1);
}
.ds-browser-frame { flex: 1 1 auto; width: 100%; height: 100%; min-height: 0; border: 0; background: #fff; }
.ds-browser-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  pointer-events: none;
}
.ds-browser-note {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-state-warn-primary);
  border-radius: 8px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  font-size: 11.5px;
  box-shadow: 0 6px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
}
.ds-browser-note-text { flex: 1 1 auto; min-width: 0; }
.ds-browser-note .ds-linkbtn { margin-left: auto; flex: 0 0 auto; }
.ds-browser-note-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.ds-browser-note-close:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); color: var(--dsw-alias-label-primary); }
.ds-browser-start {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  min-height: 0;
  overflow: auto;
  padding: 32px;
}
.ds-browser-hero { display: flex; align-items: center; gap: 12px; }
.ds-browser-hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  color: var(--dsw-alias-brand-primary);
}
.ds-browser-hero-icon svg { width: 22px; height: 22px; }
.ds-browser-hero-title { font-size: 16px; font-weight: 600; }
.ds-browser-hero-text { max-width: 560px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ds-browser-hostbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  width: 100%;
  max-width: 680px;
  padding: 7px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
}
.ds-browser-host-label { color: var(--dsw-alias-label-secondary); font-size: 11px; font-weight: 600; }
.ds-browser-scheme-select {
  height: 26px;
  padding: 0 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11px;
  outline: none;
}
.ds-browser-host-input {
  width: 180px;
  height: 26px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-mono);
  font-size: 11.5px;
  outline: none;
}
.ds-browser-host-input:focus { border-color: var(--dsw-alias-brand-primary); }
.ds-browser-host-hint { color: var(--dsw-alias-label-secondary); font-size: 10.5px; }
.ds-browser-section { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 680px; }
.ds-browser-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ds-browser-section-title { color: var(--dsw-alias-label-secondary); font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.ds-browser-ports { display: flex; flex-wrap: wrap; gap: 8px; }
.ds-browser-port {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 96px;
  padding: 7px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ds-browser-port:hover { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }
.ds-browser-port-num { color: var(--dsw-alias-brand-primary); font-family: var(--ds-mono); font-size: 12px; font-weight: 600; }
.ds-browser-port-host { color: var(--dsw-alias-label-secondary); font-size: 10px; }
.ds-browser-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ds-browser-start-hint { max-width: 620px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.6; }
.ds-browser-blocked { align-items: center; justify-content: center; }
.ds-pdfwrap { display: flex; flex: 1 1 auto; min-height: 0; }
.ds-pdf { flex: 1 1 auto; width: 100%; height: 100%; border: 0; background: var(--dsw-alias-bg-layer-1); }
.ds-imageview { display: flex; flex: 1 1 auto; align-items: center; justify-content: center; min-height: 0; overflow: auto; padding: 24px; background: var(--dsw-alias-bg-layer-1); }
.ds-imageview img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent); }
.ds-md { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 26px 34px 70px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 1.72; }
.ds-md-inner { max-width: 860px; margin: 0 auto; }
.ds-md-empty { color: var(--dsw-alias-label-secondary); font-style: italic; }
.ds-md-heading { margin: 1.3em 0 0.55em; line-height: 1.3; font-weight: 600; }
.ds-md h1 { font-size: 1.85em; margin-top: 0.6em; padding-bottom: 0.25em; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ds-md h2 { font-size: 1.45em; padding-bottom: 0.2em; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ds-md h3 { font-size: 1.2em; }
.ds-md h4 { font-size: 1.05em; }
.ds-md h5, .ds-md h6 { font-size: 1em; color: var(--dsw-alias-label-secondary); }
.ds-md-para { margin: 0.75em 0; }
.ds-md-list { margin: 0.65em 0; padding-left: 1.6em; }
.ds-md-list li { margin: 0.28em 0; }
.ds-md-link { color: var(--dsw-alias-brand-primary); text-decoration: none; }
.ds-md-link:hover { text-decoration: underline; }
.ds-md-inline-code { padding: 0.12em 0.35em; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); font-family: var(--ds-mono); font-size: 0.86em; }
.ds-md-pre { margin: 0.9em 0; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); overflow: auto; }
.ds-md-pre code { font-family: var(--ds-mono); font-size: 12.5px; line-height: 1.55; white-space: pre; }
.ds-md-quote { margin: 0.85em 0; padding: 0.2em 1em; border-left: 3px solid var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-secondary); }
.ds-md-hr { margin: 1.4em 0; border: 0; border-top: 1px solid var(--dsw-alias-border-l1); }
.ds-md-tablewrap { margin: 0.9em 0; overflow-x: auto; }
.ds-md-table { width: 100%; border-collapse: collapse; font-size: 0.92em; }
.ds-md-table th, .ds-md-table td { padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l1); text-align: left; }
.ds-md-table th { background: var(--dsw-alias-bg-layer-2); font-weight: 600; }
.ds-md-image { display: block; max-width: 100%; margin: 0.9em 0; border-radius: 6px; }
.ds-floating-chat { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.ds-chat-float-btn[data-active="true"] {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.ds-chat-float {
  position: fixed;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 240px;
  min-height: 260px;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 20px 60px color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent);
}
.ds-chat-float-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 34px;
  padding: 0 6px 0 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
  cursor: move;
  user-select: none;
  touch-action: none;
}
.ds-chat-float-icon { display: inline-flex; flex: 0 0 auto; color: var(--dsw-alias-label-secondary); }
.ds-chat-float-title {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-chat-float-select {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 190px;
  height: 22px;
  padding: 0 2px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  outline: none;
  cursor: pointer;
}
.ds-chat-float-select:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
}
.ds-chat-float-select:disabled { opacity: 0.5; cursor: default; }
.ds-chat-float-select option {
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  font-weight: 400;
}
.ds-chat-float-close { cursor: pointer; }
.ds-chat-float-body { display: flex; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.ds-chat-float-body[hidden] { display: none; }
.ds-chat-float-error {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
  color: var(--dsw-alias-state-error-primary);
  font-size: 11.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.ds-chat-float-collapsed { min-height: 36px; }
.ds-chat-float-mobile {
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  box-shadow: none;
  overscroll-behavior: contain;
}
.ds-chat-float-mobile .ds-chat-float-head {
  height: calc(48px + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  padding-left: 12px;
  padding-right: 8px;
  cursor: default;
  touch-action: auto;
}
.ds-chat-float-mobile .ds-chat-float-select { max-width: none; height: 30px; font-size: 13px; }
.ds-chat-float-mobile .ds-chat-float-body { padding-bottom: env(safe-area-inset-bottom); }
.ds-chat-float-mobile .ds-chat-float-close,
.ds-chat-float-mobile .ds-chat-float-new { width: 32px; height: 32px; }
.ds-chat-float-collapsed .ds-chat-float-head { border-bottom: 0; }
.ds-chat-float-empty {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: 18px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.ds-chat-float-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  touch-action: none;
}
.ds-chat-float-resize::after {
  content: "";
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 1.5px solid var(--dsw-alias-label-caption);
  border-bottom: 1.5px solid var(--dsw-alias-label-caption);
  opacity: 0.75;
}
`

    /* ------------------------------------------------------------------ *
     * Plugin body
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        const store = createStore(initialState())
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-web-filebrowser: dictionaries')
        const IdePage = makeIdePage(ctx, t, store)
        const IdeTitle = makeIdeTitle(t)
        ctx.effect(
          () =>
            ctx.slots.inject('main', () =>
              ctx.slots.register(
                {
                  name: 'main',
                  key: 'files',
                  locale: NS,
                  children: { [CHAT_INLINE_SLOT]: { kind: 'single', scope: 'session-maybe' } },
                },
                IdePage,
              ),
            ),
          'dsh-web-filebrowser: main panel',
        )
        ctx.effect(
          () =>
            ctx.slots.inject(CHAT_INLINE_SLOT, () =>
              ctx.slots.register({ name: CHAT_INLINE_SLOT, locale: NS }, ChatConversationPanel),
            ),
          'dsh-web-filebrowser: inline floating chat',
        )
        ctx.effect(
          () =>
            ctx.slots.inject(CHAT_SIDEBAR_INLINE_SLOT, () =>
              ctx.slots.register({ name: CHAT_SIDEBAR_INLINE_SLOT, locale: NS }, ChatConversationPanel),
            ),
          'dsh-web-filebrowser: sidebar floating chat',
        )
        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.panellist', () =>
              ctx.slots.register(
                {
                  name: 'sidebar.panellist',
                  id: 'files',
                  order: 20,
                  locale: NS,
                  label: () => t('panel.title'),
                },
                PanelIcon,
              ),
            ),
          'dsh-web-filebrowser: sidebar entry',
        )
        // The right Sidebar's Start page lists one card per registered tab type.
        // Registering here is optional: a profile without the right Sidebar keeps
        // the main-panel and left-sidebar entry points above.
        ctx.inject(['sidebarRightTabs'], (sidebarCtx) => {
          sidebarCtx.effect(
            () =>
              sidebarCtx.sidebarRightTabs.register({
                id: IDE_ID,
                kind: IDE_KIND,
                priority: 'extension',
                title: () => t('panel.title'),
                guide: [
                  {
                    id: 'workspace',
                    order: 30,
                    title: () => t('guide.title'),
                    description: () => t('guide.description'),
                    icon: GuideIcon,
                  },
                ],
              }),
            'dsh-web-filebrowser: right-sidebar tab type',
          )
          sidebarCtx.effect(
            () =>
              sidebarCtx.slots.inject('sidebar.right.pane.tab', () =>
                sidebarCtx.slots.register(
                  {
                    name: 'sidebar.right.pane.tab',
                    key: IDE_ID,
                    locale: NS,
                    children: { [CHAT_SIDEBAR_INLINE_SLOT]: { kind: 'single', scope: 'session-maybe' } },
                  },
                  IdePage,
                ),
              ),
            'dsh-web-filebrowser: right-sidebar body',
          )
          sidebarCtx.effect(
            () =>
              sidebarCtx.slots.inject('sidebar.right.pane.tab.title', () =>
                sidebarCtx.slots.register(
                  { name: 'sidebar.right.pane.tab.title', key: IDE_ID, locale: NS },
                  IdeTitle,
                ),
              ),
            'dsh-web-filebrowser: right-sidebar title',
          )
          // Legacy chat page kept registered so layouts saved by earlier builds
          // still render their tab. New opens use the collapsible overlay above.
          sidebarCtx.effect(
            () =>
              sidebarCtx.sidebarRightTabs.register({
                id: CHAT_TAB_ID,
                kind: CHAT_TAB_KIND,
                priority: 'extension',
                title: () => t('chat.title'),
              }),
            'dsh-web-filebrowser: legacy chat tab type',
          )
          sidebarCtx.effect(
            () =>
              sidebarCtx.slots.inject('sidebar.right.pane.tab', () =>
                sidebarCtx.slots.register(
                  {
                    name: 'sidebar.right.pane.tab',
                    key: CHAT_TAB_ID,
                    locale: NS,
                    children: { [CHAT_CONTENT_SLOT]: { kind: 'single', scope: 'session' } },
                  },
                  ChatTabBody,
                ),
              ),
            'dsh-web-filebrowser: legacy chat tab body',
          )
          sidebarCtx.effect(
            () =>
              sidebarCtx.slots.inject(CHAT_CONTENT_SLOT, () =>
                sidebarCtx.slots.register({ name: CHAT_CONTENT_SLOT, locale: NS }, ChatConversationPanel),
              ),
            'dsh-web-filebrowser: legacy chat conversation',
          )
        })
      },
    }
  },
})
