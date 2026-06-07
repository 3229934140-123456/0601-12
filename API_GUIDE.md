# 创意设计平台 API 接口说明

## 基础信息

- 服务地址：`http://localhost:3000`
- 接口前缀：`/api`
- 认证方式：请求头 `X-User-Id`（当前为 Mock 用户 ID）
- 响应格式：`{ code: number, message: string, data?: any }`
- 默认用户：`user-001`（设计师小明，owner）、`user-002`（产品经理小红，editor）

---

## 权限模型

| 角色 | 查看项目 | 评论 | 编辑画布 | 改尺寸 | 邀请成员 | 导出普通格式 | 导出源文件 |
|------|----------|------|----------|--------|----------|-------------|-----------|
| viewer | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| editor | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| owner  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> 非项目成员访问项目相关接口返回 **403 无权限**。

---

## 一、项目管理接口

### 典型调用顺序

```
创建项目 → 获取项目详情 → 修改页面尺寸 → 邀请成员 → 查看历史版本
```

### 1. 获取项目列表

```
GET /api/projects
Query: page=1&pageSize=10&keyword=海报&status=draft
Header: X-User-Id: user-001
```

响应（节选）：
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "proj-001",
        "name": "品牌宣传海报",
        "pageSize": { "width": 1080, "height": 1920, "unit": "px" },
        "status": "draft",
        "currentVersion": 1
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

### 2. 创建项目

```
POST /api/projects
Header: X-User-Id: user-001
Body:
{
  "name": "新品活动页",
  "description": "618活动落地页设计",
  "pageSize": {
    "width": 750,
    "height": 1334,
    "unit": "px",
    "name": "手机端"
  }
}
```

### 3. 获取项目详情

```
GET /api/projects/:id
Header: X-User-Id: user-001
```

> 非成员返回 `403 无权限访问该项目`

### 4. 更新项目

```
PUT /api/projects/:id
Header: X-User-Id: user-001
Body: { "name": "新名称", "description": "新描述", "thumbnail": "" }
```

### 5. 修改页面尺寸

```
PUT /api/projects/:id/page-size
Header: X-User-Id: user-001
Body:
{
  "width": 1920,
  "height": 1080,
  "unit": "px",
  "name": "横版海报"
}
```

> 宽度/高度为空或非正数 → `400 宽度不能为空` 等
> 单位非法 → `400 单位不支持，仅支持 px、mm、in`

### 6. 邀请成员

```
POST /api/projects/:id/members
Header: X-User-Id: user-001
Body:
{
  "email": "designer2@example.com",
  "role": "editor",
  "userId": "user-003"
}
```

> role 可选：`owner` / `editor` / `viewer`

### 7. 修改成员角色

```
PUT /api/projects/:id/members/:userId
Header: X-User-Id: user-001
Body: { "role": "viewer" }
```

### 8. 查看历史版本列表

```
GET /api/projects/:id/versions
Header: X-User-Id: user-001
```

响应：
```json
{
  "code": 0,
  "data": [
    {
      "version": 1,
      "snapshotName": "初始版本",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "layerCount": 2
    }
  ]
}
```

---

## 二、画布管理接口

### 典型调用顺序

```
获取当前画布 → 添加图层 → 修改图层 → 重排图层 → 保存画布（生成新版本）
                              ↓
                         创建快照 / 恢复版本
```

### 1. 获取当前画布

```
GET /api/canvas/:projectId/current
Header: X-User-Id: user-001
```

响应中 `layers` 数组按 `zIndex` 从小到大排序。

### 2. 获取指定版本画布

```
GET /api/canvas/:projectId/version/:version
Header: X-User-Id: user-001
```

### 3. 保存画布（生成新版本）

```
POST /api/canvas/:projectId/save
Header: X-User-Id: user-001
Body:
{
  "layers": [...图层数组...],
  "background": "#ffffff",
  "snapshotName": "首页改版v2"
}
```

> 保存成功后项目 `currentVersion` 自动 +1

### 4. 添加图层

```
POST /api/canvas/:projectId/layers
Header: X-User-Id: user-001
Body:
{
  "type": "rectangle",
  "name": "圆角矩形",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 100,
  "props": { "fill": "#FF6B6B", "borderRadius": 8 }
}
```

### 5. 修改图层

```
PUT /api/canvas/:projectId/layers/:layerId
Header: X-User-Id: user-001
Body: { "x": 200, "y": 200, "props": { "fill": "#4ECDC4" } }
```

### 6. 删除图层

```
DELETE /api/canvas/:projectId/layers/:layerId
Header: X-User-Id: user-001
```

### 7. 复制图层

```
POST /api/canvas/:projectId/layers/:layerId/duplicate
Header: X-User-Id: user-001
```

### 8. 重排图层（图层排序）

```
PUT /api/canvas/:projectId/layers/reorder
Header: X-User-Id: user-001
Body:
{
  "layerIds": ["layer-title", "layer-bg"]
}
```

**说明**：
- `layerIds` 数组顺序即为新的图层顺序（从底到顶）
- 返回结果按 `zIndex` 从小到大排序
- 排序后再次读取当前画布，顺序保持一致

**示例（交换两个图层顺序）**：

初始顺序（zIndex 从小到大）：
```
layer-bg   (zIndex: 0)   ← 底层
layer-title (zIndex: 1)  ← 顶层
```

请求：
```json
{ "layerIds": ["layer-title", "layer-bg"] }
```

结果：
```
layer-title (zIndex: 0)  ← 底层
layer-bg   (zIndex: 1)   ← 顶层
```

### 9. 创建快照

```
POST /api/canvas/:projectId/snapshot
Header: X-User-Id: user-001
Body: { "name": "设计稿最终版" }
```

### 10. 恢复版本

```
POST /api/canvas/:projectId/restore/:version
Header: X-User-Id: user-001
```

> 恢复后会生成新版本（版本号 +1），不会覆盖历史版本

---

## 三、素材管理接口

### 典型调用顺序

```
获取素材列表 → 上传素材 → 搜索字体/配色 → 使用素材
```

### 1. 获取素材列表

```
GET /api/assets
Query: page=1&pageSize=20&type=image&keyword=logo&category=品牌素材
```

### 2. 获取配色方案

```
GET /api/assets/colors
Query: keyword=品牌&category=官方
```

### 3. 获取字体列表

```
GET /api/assets/fonts
Query: keyword=苹方&family=PingFang SC
```

### 4. 上传素材

```
POST /api/assets
Content-Type: multipart/form-data
Header: X-User-Id: user-001
FormData:
  - file: 【文件】
  - name: 品牌Logo
  - type: image
  - tags: ["logo", "brand"]
  - category: 品牌素材
```

### 5. 获取素材分类 & 标签

```
GET /api/assets/categories
GET /api/assets/tags
```

---

## 四、评论/批注接口

### 典型调用顺序

```
提交评论 → 查看评论 → 标记已解决 → 回复评论
```

### 1. 获取评论列表

```
GET /api/comments/:projectId
Query: page=1&pageSize=20&resolved=false&version=1
Header: X-User-Id: user-001
```

### 2. 提交评论

```
POST /api/comments/:projectId
Header: X-User-Id: user-002
Body:
{
  "content": "主标题字体可以再大一些",
  "position": { "x": 200, "y": 350 },
  "canvasVersion": 1
}
```

> `content` 不能为空字符串，否则返回 `400 评论内容不能为空`

### 3. 更新评论

```
PUT /api/comments/:projectId/:commentId
Header: X-User-Id: user-002
Body: { "content": "修改后的评论内容" }
```

> 只有评论作者可以修改；内容不能改成空字符串

### 4. 标记已解决 / 取消解决

```
POST /api/comments/:projectId/:commentId/resolve
POST /api/comments/:projectId/:commentId/unresolve
Header: X-User-Id: user-001
```

> owner / editor 可以操作，viewer 不行

### 5. 回复评论

```
POST /api/comments/:projectId/:commentId/reply
Header: X-User-Id: user-001
Body: { "content": "收到，马上调整" }
```

---

## 五、审核流程接口

### 典型调用顺序

```
发起审核 → 审核人查看待审核 → 通过 / 驳回 / 要求修改 → 提交人收到通知
```

### 1. 发起审核

```
POST /api/reviews/:projectId
Header: X-User-Id: user-001
Body:
{
  "reviewers": ["user-002"],
  "canvasVersion": 2,
  "feedback": "请帮忙审核一下新版本"
}
```

> 项目状态自动变为 `reviewing`

### 2. 获取项目审核列表

```
GET /api/reviews/:projectId
Query: status=pending
Header: X-User-Id: user-001
```

### 3. 我的待审核

```
GET /api/reviews/mine
Query: status=pending
Header: X-User-Id: user-002
```

### 4. 审核详情

```
GET /api/reviews/:projectId/:reviewId
Header: X-User-Id: user-002
```

### 5. 审核通过

```
POST /api/reviews/:projectId/:reviewId/approve
Header: X-User-Id: user-002
Body: { "feedback": "设计很棒，可以上线" }
```

> 项目状态自动变为 `approved`

### 6. 审核驳回

```
POST /api/reviews/:projectId/:reviewId/reject
Header: X-User-Id: user-002
Body: { "feedback": "整体风格不对，需要重设计" }
```

> 项目状态自动变为 `draft`

### 7. 要求修改

```
POST /api/reviews/:projectId/:reviewId/request-changes
Header: X-User-Id: user-002
Body: { "feedback": "主标题再大一些，配色调整下" }
```

> 项目状态自动变为 `draft`

---

## 六、导出接口

### 典型调用顺序

```
生成预览图 → 按规格导出 → 轮询任务状态 → 下载文件
            ↘ 打包源文件 ↗
```

### 1. 生成预览图

```
POST /api/export/:projectId/preview
Header: X-User-Id: user-001
```

响应：
```json
{
  "code": 0,
  "data": {
    "url": "/api/export/proj-001/preview.png",
    "width": 1080,
    "height": 1920,
    "version": 1,
    "projectName": "品牌宣传海报",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "format": "png"
  }
}
```

### 2. 直接访问预览图

```
GET /api/export/:projectId/preview.png
GET /api/export/:projectId/preview.svg
Header: X-User-Id: user-001
```

> 直接返回 SVG 图片响应（可在浏览器中打开查看）
> 响应头含 `X-Project-Version`、`X-Preview-Width`、`X-Preview-Height`、`X-Created-At`

### 3. 按指定规格导出

```
POST /api/export/:projectId/by-spec
Header: X-User-Id: user-001
Body:
{
  "format": "png",
  "scale": 2,
  "quality": 90,
  "width": 2160,
  "height": 3840
}
```

支持的格式：`png`、`jpg`、`svg`、`pdf`、`source`

> 格式不支持 → `400 不支持的导出格式，仅支持 png、jpg、svg、pdf、source`
> 导出源文件需要 owner/editor 权限

### 4. 打包源文件

```
POST /api/export/:projectId/source
Header: X-User-Id: user-001
```

> viewer 权限不能导出源文件，返回 `403 没有权限导出源文件`

### 5. 批量导出

```
POST /api/export/:projectId/batch
Header: X-User-Id: user-001
Body:
{
  "specs": [
    { "format": "png", "scale": 1 },
    { "format": "svg" },
    { "format": "pdf" }
  ]
}
```

### 6. 获取导出任务列表

```
GET /api/export/:projectId/tasks
Query: status=completed
Header: X-User-Id: user-001
```

### 7. 获取单个导出任务

```
GET /api/export/tasks/:taskId
Header: X-User-Id: user-001
```

### 8. 下载导出文件

```
GET /api/export/download/:taskId
Header: X-User-Id: user-001
```

> 任务完成后返回对应格式的文件内容（带 Content-Disposition 下载头）
> 任务未完成 → `400 导出任务尚未完成`
> 无权限 → `403 无权限下载`

---

## 七、通知接口

### 典型调用顺序

```
接收通知 → 标记已读 → 查看操作动态 → 查看团队统计
```

### 1. 获取通知列表

```
GET /api/notifications
Query: page=1&pageSize=20&type=comment&unreadOnly=true
```

### 2. 未读数量

```
GET /api/notifications/unread-count
```

响应：
```json
{
  "code": 0,
  "data": { "unreadCount": 3 }
}
```

### 3. 标记单条已读

```
PUT /api/notifications/:id/read
```

### 4. 全部标记已读

```
PUT /api/notifications/read-all
```

### 5. 清空通知

```
DELETE /api/notifications/clear
```

### 6. 全局操作动态

```
GET /api/notifications/activities
Query: page=1&pageSize=20&type=create_project
```

### 7. 项目操作动态

```
GET /api/notifications/activities/project/:projectId
Query: page=1&pageSize=20
Header: X-User-Id: user-001
```

> 非项目成员返回 `403 没有权限查看`

### 8. 团队使用统计

```
GET /api/notifications/stats/team/:teamId
Query: period=week
```

响应包含：
- 总项目数、总编辑次数、总导出次数
- 总成员数、活跃用户数、存储使用量
- 近 7 天项目趋势
- Top 5 项目排行

---

## 完整业务流程示例

### 流程：从创建项目到导出交付

```
1. 创建项目          POST /api/projects
2. 添加图层          POST /api/canvas/:projectId/layers (多次)
3. 调整图层排序      PUT  /api/canvas/:projectId/layers/reorder
4. 保存画布          POST /api/canvas/:projectId/save
5. 邀请评审成员      POST /api/projects/:id/members
6. 提交审核          POST /api/reviews/:projectId
7. 审核人收到通知    GET  /api/notifications/unread-count
8. 审核通过          POST /api/reviews/:projectId/:reviewId/approve
9. 生成预览图        POST /api/export/:projectId/preview
10. 导出多规格       POST /api/export/:projectId/batch
11. 轮询任务完成     GET  /api/export/tasks/:taskId
12. 下载交付         GET  /api/export/download/:taskId
13. 查看动态         GET  /api/notifications/activities/project/:projectId
```

### 流程：协作修改

```
1. viewer 提交评论    POST /api/comments/:projectId
2. editor 收到通知    GET  /api/notifications
3. editor 修改画布    PUT  /api/canvas/:projectId/layers/:id
4. editor 保存新版本  POST /api/canvas/:projectId/save
5. editor 标记已解决  POST /api/comments/:projectId/:commentId/resolve
6. viewer 查看变化    GET  /api/canvas/:projectId/current
```

---

## 错误码速查

| HTTP 状态码 | 场景 |
|------------|------|
| 200 | 成功 |
| 400 | 参数错误（空值、格式不对等） |
| 403 | 无权限（非成员、角色不足） |
| 404 | 资源不存在（项目/评论/任务等） |
| 500 | 服务器内部错误 |

业务 `code` 字段与 HTTP 状态码保持一致。
