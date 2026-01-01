/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Select, Space, Table, Typography, Descriptions, Tabs, TabPane, DatePicker } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';

function isAxiosError403(error) {
  return error?.name === 'AxiosError' && error?.response?.status === 403;
}

function displayName(userId, username) {
  const u = (username || '').trim();
  if (u) return u;
  return String(userId ?? '');
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN');
}

export default function ActiveTaskRankPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('realtime');

  const [inputs, setInputs] = useState({
    window: 30,
    limit: 50,
  });

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [errorText, setErrorText] = useState('');

  // 历史记录状态
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyInputs, setHistoryInputs] = useState({
    dateRange: null,
    limit: 100,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await API.get('/api/active_task/stats', { skipErrorHandler: true });
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const query = useCallback(async () => {
    const windowSec = Number(inputs.window) || 30;
    const limit = Number(inputs.limit) || 50;

    setLoading(true);
    setErrorText('');
    try {
      const res = await API.get('/api/active_task/rank', {
        params: { window: windowSec, limit },
        skipErrorHandler: true,
      });

      const { success, message, data } = res.data || {};
      if (!success) {
        const msg = message || '查询失败';
        setErrorText(msg);
        showError(msg);
        return;
      }

      const list = Array.isArray(data?.rank) ? data.rank : [];
      list.sort((a, b) => (Number(b?.active_slots) || 0) - (Number(a?.active_slots) || 0));
      setRows(list);
      
      // 同时刷新统计信息
      fetchStats();
    } catch (e) {
      if (isAxiosError403(e)) {
        navigate('/forbidden', { replace: true });
        return;
      }
      setErrorText(e?.message || '请求失败');
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [inputs.window, inputs.limit, navigate, fetchStats]);

  // 查询历史记录
  const queryHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = { limit: historyInputs.limit };
      if (historyInputs.dateRange && historyInputs.dateRange.length === 2) {
        params.start_time = Math.floor(historyInputs.dateRange[0].getTime() / 1000);
        params.end_time = Math.floor(historyInputs.dateRange[1].getTime() / 1000);
      }

      const res = await API.get('/api/active_task/history', {
        params,
        skipErrorHandler: true,
      });

      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || '查询失败');
        return;
      }

      setHistoryRows(Array.isArray(data?.records) ? data.records : []);
    } catch (e) {
      if (isAxiosError403(e)) {
        navigate('/forbidden', { replace: true });
        return;
      }
      showError(e?.message || '请求失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyInputs, navigate]);

  // 初始加载
  useEffect(() => {
    query();
  }, []);

  // 切换到历史tab时加载数据
  useEffect(() => {
    if (activeTab === 'history' && historyRows.length === 0) {
      queryHistory();
    }
  }, [activeTab]);

  // 自动刷新（每5秒，仅实时tab）
  useEffect(() => {
    if (activeTab !== 'realtime') return;
    const interval = setInterval(() => {
      query();
    }, 5000);
    return () => clearInterval(interval);
  }, [query, activeTab]);

  const columns = useMemo(
    () => [
      {
        title: '排名',
        key: 'rank',
        width: 80,
        render: (_, __, idx) => <span>{idx + 1}</span>,
      },
      {
        title: '用户ID',
        dataIndex: 'user_id',
        key: 'user_id',
        width: 100,
        render: (v) => <span>{String(v)}</span>,
      },
      {
        title: '用户名',
        key: 'username',
        render: (_, r) => <span>{displayName(r?.user_id, r?.username)}</span>,
      },
      {
        title: '活跃任务数',
        dataIndex: 'active_slots',
        key: 'active_slots',
        width: 120,
        sorter: (a, b) => (Number(a?.active_slots) || 0) - (Number(b?.active_slots) || 0),
        defaultSortOrder: 'descend',
      },
    ],
    [],
  );

  const historyColumns = useMemo(
    () => [
      {
        title: '用户ID',
        dataIndex: 'user_id',
        key: 'user_id',
        width: 100,
      },
      {
        title: '用户名',
        dataIndex: 'username',
        key: 'username',
      },
      {
        title: '活跃任务数',
        dataIndex: 'active_slots',
        key: 'active_slots',
        width: 120,
        sorter: (a, b) => (Number(a?.active_slots) || 0) - (Number(b?.active_slots) || 0),
      },
      {
        title: '时间窗口',
        dataIndex: 'window_secs',
        key: 'window_secs',
        width: 100,
        render: (v) => `${v}秒`,
      },
      {
        title: '记录时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (v) => formatTime(v),
        sorter: (a, b) => (a?.created_at || 0) - (b?.created_at || 0),
        defaultSortOrder: 'descend',
      },
    ],
    [],
  );

  const renderRealtimeTab = () => (
    <>
      {stats && (
        <div className='mb-4'>
          <Descriptions
            data={[
              { key: '总槽数', value: `${stats.total_slots} / ${stats.max_global_slots}` },
              { key: '活跃槽数', value: stats.active_slots },
              { key: '活跃用户数', value: stats.active_users },
              { key: '单用户上限', value: stats.max_user_slots },
              { key: '时间窗口', value: `${stats.window_seconds}秒` },
            ]}
            row
            size='small'
          />
        </div>
      )}

      <Form layout='vertical'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          <div>
            <label className='semi-form-field-label'>
              <span className='semi-form-field-label-text'>时间窗口（秒）</span>
            </label>
            <Select
              optionList={[
                { label: '10秒', value: 10 },
                { label: '30秒', value: 30 },
                { label: '60秒', value: 60 },
                { label: '120秒', value: 120 },
                { label: '300秒 (5分钟)', value: 300 },
                { label: '600秒 (10分钟)', value: 600 },
                { label: '1800秒 (30分钟)', value: 1800 },
                { label: '3600秒 (1小时)', value: 3600 },
              ]}
              value={inputs.window}
              onChange={(v) => setInputs((prev) => ({ ...prev, window: Number(v) || 30 }))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className='semi-form-field-label'>
              <span className='semi-form-field-label-text'>显示数量</span>
            </label>
            <Select
              optionList={[
                { label: '20', value: 20 },
                { label: '50', value: 50 },
                { label: '100', value: 100 },
                { label: '200', value: 200 },
              ]}
              value={inputs.limit}
              onChange={(v) => setInputs((prev) => ({ ...prev, limit: Number(v) || 50 }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className='flex gap-2 mt-2'>
          <Button type='primary' onClick={query} loading={loading}>
            查询
          </Button>
        </div>
      </Form>

      {errorText ? (
        <div className='mt-3'>
          <Typography.Text type='danger'>{errorText}</Typography.Text>
        </div>
      ) : null}

      <div className='mt-4'>
        <Table
          bordered
          size='small'
          loading={loading}
          columns={columns}
          dataSource={(rows || []).map((r, idx) => ({
            ...r,
            key: `${r?.user_id ?? 'u'}-${idx}`,
          }))}
          pagination={false}
        />
      </div>
    </>
  );

  const renderHistoryTab = () => (
    <>
      <Form layout='vertical'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          <div>
            <label className='semi-form-field-label'>
              <span className='semi-form-field-label-text'>时间范围</span>
            </label>
            <DatePicker
              type='dateTimeRange'
              value={historyInputs.dateRange}
              onChange={(v) => setHistoryInputs((prev) => ({ ...prev, dateRange: v }))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className='semi-form-field-label'>
              <span className='semi-form-field-label-text'>显示数量</span>
            </label>
            <Select
              optionList={[
                { label: '50', value: 50 },
                { label: '100', value: 100 },
                { label: '200', value: 200 },
                { label: '500', value: 500 },
              ]}
              value={historyInputs.limit}
              onChange={(v) => setHistoryInputs((prev) => ({ ...prev, limit: Number(v) || 100 }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className='flex gap-2 mt-2'>
          <Button type='primary' onClick={queryHistory} loading={historyLoading}>
            查询
          </Button>
        </div>
      </Form>

      <div className='mt-4'>
        <Table
          bordered
          size='small'
          loading={historyLoading}
          columns={historyColumns}
          dataSource={(historyRows || []).map((r, idx) => ({
            ...r,
            key: `${r?.id ?? idx}`,
          }))}
          pagination={{ pageSize: 20 }}
        />
      </div>
    </>
  );

  return (
    <div className='mt-[60px] px-2'>
      <Card
        className='!rounded-2xl'
        title='活跃任务'
        headerExtraContent={
          activeTab === 'realtime' ? (
            <Space>
              <Typography.Text type='tertiary' size='small'>
                每5秒自动刷新
              </Typography.Text>
              <Button type='tertiary' loading={loading} onClick={query}>
                刷新
              </Button>
            </Space>
          ) : (
            <Button type='tertiary' loading={historyLoading} onClick={queryHistory}>
              刷新
            </Button>
          )
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab='实时监控' itemKey='realtime'>
            {renderRealtimeTab()}
          </TabPane>
          <TabPane tab='历史记录' itemKey='history'>
            {renderHistoryTab()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
