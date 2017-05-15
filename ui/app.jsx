/**
 * @author oldj
 * @blog http://oldj.net
 */

'use strict'

import React from 'react'
import Panel from './panel/panel'
import Content from './content/content'
import SudoPrompt from './frame/sudo'
import EditPrompt from './frame/edit'
import PreferencesPrompt from './frame/preferences'
import NotificationSystem from 'react-notification-system'
import Agent from './Agent'
import { reg as events_reg } from './events/index'
import notificationStyle from './misc/notificationStyle'
import './app.less'

export default class App extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      list: [], // 用户的 hosts 列表
      sys_hosts: {}, // 系统 hosts
      current: {}, // 当前 hosts
      lang: {}, // 语言
      just_added_id: null
    }

    this.is_dragging = false
    this._notificationSystem = null
    this.loadHosts()

    Agent.pact('getPref')
      .then(pref => {
        return pref.user_language || 'en'
      })
      .then(l => {
        Agent.pact('getLang', l).then(lang => {
          this.setState({lang})
        })
      })

    events_reg(this)

    Agent.on('drag_start', () => {
      this.is_dragging = true
      console.log('drag_start')
    })

    Agent.on('drag_end', () => {
      this.is_dragging = false
      console.log('drag_end')
    })

    Agent.on('err', e => {
      console.log(e)
      this._notificationSystem.addNotification({
        title: e.title,
        message: e.content,
        position: 'tr',
        autoDismiss: 10,
        level: 'error'
      })
    })

    setInterval(() => {
      let list = this.state.list
      if (this.is_dragging || !list || list.length === 0) return

      console.log('checkNeedRemoteRefresh')
      Agent.pact('checkNeedRemoteRefresh', list)
        .then(list => {
          if (!list) return
          Agent.emit('list_updated', list)
        })
        .catch(e => {
          console.log(e)
        })
    }, 60 * 1000)
  }

  loadHosts () {
    Agent.pact('getHosts').then(data => {
      let state = {
        list: data.list,
        sys_hosts: data.sys_hosts
      }
      let current = this.state.current
      state.current = data.list.find(item => item.id === current.id) ||
        data.sys_hosts

      this.setState(state)
    })
  }

  setCurrent (hosts) {
    if (hosts.is_sys) {
      Agent.pact('getSysHosts')
        .then(_hosts => {
          this.setState({
            sys_hosts: _hosts,
            current: _hosts
          })
        })
    } else {
      this.setState({
        current: hosts
      })
    }
  }

  static isReadOnly (hosts) {
    return !hosts || hosts.is_sys || hosts.where === 'remote' ||
      hosts.where === 'group'
  }

  toSave () {
    clearTimeout(this._t)

    this._t = setTimeout(() => {
      Agent.emit('save', this.state.list)
    }, 1000)
  }

  setHostsContent (v) {
    if (this.state.current.content === v) return // not changed

    let current = Object.assign({}, this.state.current, {
      content: v || ''
    })
    let list = this.state.list.slice(0)
    let idx = list.findIndex(i => i.id === current.id)
    if (idx !== -1) {
      list.splice(idx, 1, current)
    }

    this.setState({
      current,
      list
    }, () => {
      this.toSave()
    })
  }

  justAdd (id) {
    this.setState({
      just_added_id: id
    })
  }

  componentDidMount () {
    this._notificationSystem = this.refs.notificationSystem

    window.addEventListener('keydown', (e) => {
      if (e.keyCode === 27) {
        Agent.emit('esc')
      }
    }, false)

    window.addEventListener('mouseup', () => {
      Agent.emit('drag_end')
    })
  }

  render () {
    let current = this.state.current
    return (
      <div id="app" className={'platform-' + Agent.platform}>
        <NotificationSystem ref="notificationSystem" style={notificationStyle}/>
        <Panel
          list={this.state.list}
          sys_hosts={this.state.sys_hosts}
          current={current}
          setCurrent={this.setCurrent.bind(this)}
          lang={this.state.lang}
          just_added_id={this.state.just_added_id}
          justAdd={this.justAdd.bind(this)}
        />
        <Content
          current={current}
          readonly={App.isReadOnly(current)}
          setHostsContent={this.setHostsContent.bind(this)}
          lang={this.state.lang}
        />
        <div className="frames">
          <SudoPrompt lang={this.state.lang}/>
          <EditPrompt
            lang={this.state.lang}
            list={this.state.list}
            justAdd={this.justAdd.bind(this)}
          />
          <PreferencesPrompt
            lang={this.state.lang}
          />
        </div>
      </div>
    )
  }
}