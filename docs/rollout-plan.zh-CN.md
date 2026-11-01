# 加州野火平台：上线和持续更新计划

## 当前实现

网站由定时任务集中抓取数据，所有访客读取相同的静态快照。抓取失败时，脚本不会覆盖原有快照；页面显示上次成功抓取时间和“old”状态。FIRMS 还保留一个滚动五日快照供“蔓延感知”功能使用，不再每天新增一个历史文件。仓库已有的旧日期文件没有删除。

| 图层 | 抓取任务 | 计划频率 | 公共文件 | 页面检查频率 | 判定旧数据 |
| --- | --- | --- | --- | --- | --- |
| NASA FIRMS 火点 | `auto-firms.yml` | 约每 30 分钟 | `public/data/firms_ca_latest.geojson`、`firms_ca_recent.geojson` | 5 分钟 | 超过 90 分钟 |
| WFIGS 火场边界 | `auto-firms.yml` | 约每 30 分钟 | `public/data/wfigs_perimeters_latest.geojson` | 5 分钟 | 超过 90 分钟 |
| CAL FIRE 事故 | `auto-firms.yml` | 约每 30 分钟 | `public/data/calfire_incidents_latest.geojson` | 5 分钟 | 超过 90 分钟 |
| EPA AirNow PM₂.₅ 监测点 | `auto-smoke.yml` | 每小时约 :40 | `public/data/smoke_ca_latest.geojson` | 5 分钟 | 最后观测超过 3 小时 |
| NOAA HRRR 风 | `auto-wind.yml` | 每天一次 | `Data/Wind/wind_ca_velocity.json` | 1 小时 | 超过 36 小时 |
| NDVI | 离线生成 | 尚未自动化 | `Data/*.gif` | 不适用 | 标为历史数据 |

“最后抓取时间”表示任务成功获取数据的时间，不等于卫星观测时间，也不保证数据源刚刚产生了新观测。GitHub Actions 定时任务可能延迟或跳过，因此以上频率是目标，不是严格时效保证。

## 阶段一：审查代码并部署

1. 在本地运行 `git status --short`。当前工作区已有大量修改过的旧 FIRMS 日期文件；逐项审查，不要直接运行 `git add .`，以免把无关历史数据或密钥提交上去。
2. 检查本次实现的文件：`.github/workflows/auto-firms.yml`、`auto-smoke.yml`、`auto-wind.yml`，`scripts/fetch_*.js`、`scripts/airnow_snapshot.js`、`scripts/check_public_data.js`，`js/data_status.js`、`js/Fire_Mode.js`、`js/smoke_mode.js`、`js/wind_mode.js`、`js/main.js`，`Backend/validate_wind.py`，`index.html`，`package.json`、`README.md` 和本计划。
3. 确认 `.gitignore` 已忽略 `.env`、`Data/Smoke/` 等本地敏感文件；检查公开的 GeoJSON 没有 API 密钥。运行 `npm run check:public-data`。
4. 旧提交历史曾包含带密钥的 FIRMS URL 和写在脚本里的 AirNow 密钥。修复当前文件不会清除 Git 历史；请在数据提供方后台轮换这些旧密钥，再更新 GitHub Actions Secrets。不要把新密钥复制到聊天、提交或截图中。
5. 只暂存审查通过的代码和配置，提交并推送到 GitHub 默认分支。若网站使用 GitHub Pages，确认 Pages 的构建来源包含仓库根目录和 `public/data/`，并确认新提交完成部署。
6. 打开网站，确认标题栏有数据时间标签。首次上线时，新增的 WFIGS、烟雾快照可能显示 unavailable，下一阶段手动运行任务后才会出现。

## 阶段二：配置密钥和运行一次抓取

1. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions → Repository secrets** 中确认 `FIRMS_KEY` 存在。不要将密钥写进代码、网页或公开文件。
2. 在同一位置确认 `AIRNOW_API_KEY` 已存在。此密钥只交给 GitHub Actions，网页不会看到它；密钥名称必须完全一致。
3. 在 **Settings → Actions → General → Workflow permissions** 中确认工作流可以写入仓库内容。若分支保护规则阻止 Actions 推送，需要给数据更新任务一个符合该规则的写入路径或改用对象存储。
4. 打开 **Actions → Update fire snapshots (CA) → Run workflow**，手动执行一次。检查 CAL FIRE、WFIGS、FIRMS 三个抓取步骤和最终提交步骤；确认 `public/data/` 下四个最新快照出现或更新。FIRMS 脚本会向 NASA 请求一天和五天两个时间窗。
5. 打开 **Actions → Update smoke snapshot (CA) → Run workflow**，手动执行一次。确认生成 `public/data/smoke_ca_latest.geojson`，并检查日志中的监测点数量和最后观测时间。之后任务每小时约 :40 自动运行；不要再配置旧的烟雾自动抓取变量。
6. 打开 **Actions → Auto Fetch & Upload Wind Data → Run workflow**，手动执行一次。此前线上任务在“校验风 JSON”步骤因路径错误失败；新工作流已改用 `Data/Wind`。确认抓取、校验、提交都成功，特别检查 `Data/Wind/wind_ca_velocity.json` 的 `header.refTime` 已更新。现在只提交缩小后的网页风场文件，原始大文件不再每日提交。

## 阶段三：验收网页显示与失败处理

1. 等待 GitHub Pages 或你的站点托管完成发布，再用浏览器打开 Fire 模式。核对 WFIGS、FIRMS、CAL FIRE 三个标签的时间；点击几个火点和边界，确认地图仍正常显示。
2. 打开 Smoke 模式，核对监测点、AQI、观测时间和抓取时间。网站读取公开快照。浏览器开发者工具的 Network 中应看到 `smoke_ca_latest.geojson`，不应看到带密钥的 AirNow 请求。
3. 打开 Wind 模式，确认风场显示和时间标签。点击刷新按钮，确认可重新加载仓库里的风数据。
4. 在浏览器保持 Fire 或 Smoke 模式超过五分钟；检查会自动重新读取快照。可用浏览器 Network 查看请求。注意：页面重读快照，不会额外消耗上游 API 额度。
5. 模拟失败时可临时使用浏览器离线模式：地图已载入的图层应保留，标签应显示旧数据。恢复网络后再检查刷新。上线后还应关注 GitHub Actions 的实际失败日志；文件是否更新以成功提交和部署为准。

## 阶段四：控制 API 请求并处理失败

1. AirNow 观测一般按小时更新，因此只让一个 GitHub Actions 任务每小时请求一次加州范围数据；访客刷新页面不会增加 AirNow API 请求。官方建议缓存小时观测数据，且说明超出某项服务的小时限额后该小时可能无法返回数据。
2. 每周查看 AirNow 工作流的请求次数和失败情况。若出现限额或服务错误，先检查是否有旧脚本、Vercel 服务或重复工作流仍在调用同一密钥，再考虑降低任务频率。不要通过循环重试消耗更多配额。
3. AirNow 返回空结果、错误 JSON、无有效 PM₂.₅ AQI 或过旧观测时，更新任务失败并保留上次成功快照。网页显示最后观测时间，并将旧数据标记出来。检查 Actions 日志，恢复后手动重跑。
4. 空气质量监测点观测是初步数据，不等于火场烟雾扩散预测。需要显示预测烟羽时，另接专门的烟雾模型数据源，并独立标注。

## 阶段五：长期运行与扩容

1. 每周查看三条工作流最近几次运行是否成功，查看网站标签是否持续更新。GitHub Actions 的计划运行可能延迟，不能把 cron 时间当成严格 SLA。
2. 每月检查 AirNow 请求情况、仓库 `.git` 大小、网页加载时间和 GitHub Pages 发布大小。风场现在下采样并只提交网页用的速度文件，减少每日 Git 历史增长；若仍明显增长，再迁移到对象存储。
3. 当 Git 历史或部署流量明显增长时，将自动生成的快照移到对象存储（S3、GCS 或 R2）。保留相同的 `latest` 文件名和元数据字段，网页只需调整文件 URL；历史文件放入对象存储并设置保留期。对象存储可能产生存储与流量费用，应先设预算和监控。
4. 如果需要严格分钟级时效，改用有运行保障的调度服务，并为每个数据源设独立的时效目标、失败告警和持久缓存。卫星火点仍受卫星过境和上游处理时间约束，页面无法凭更频繁刷新生成新观测。
