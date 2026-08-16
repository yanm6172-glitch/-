"""
问题一：单金属A颗粒导通判断
读取附件1中12个颗粒坐标，判断每个颗粒是否能导通微构体
"""
import sys
import os
# Add parent directory (求解/) to path for core_geometry import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

# 中文字体配置
plt.rcParams['font.sans-serif'] = ['STHeiti', 'SimHei', 'Heiti TC',
    'Arial Unicode MS', 'Hiragino Sans GB', 'PingFang SC',
    'Microsoft YaHei', 'Songti SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 150
plt.rcParams['savefig.bbox'] = 'tight'

from core_geometry import (
    CUBE_SIZE, CUBE_HALF, R_A, L_A, TUNNELING_DIST,
    ELECTRODE_LEFT, ELECTRODE_RIGHT,
    clamp_to_cube, segment_periodic_images,
    cylinder_to_plane_distance, cylinder_surface_distance,
    check_conduction
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(BASE_DIR, '图片')
OUT_DIR = os.path.join(BASE_DIR, '结果')
os.makedirs(FIG_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), '..', '数据')

def despine(ax):
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

def save_fig(fig, name):
    fig.savefig(os.path.join(FIG_DIR, name))
    plt.close(fig)

def save_csv(df, name):
    df.to_csv(os.path.join(OUT_DIR, name), index=False, encoding='utf-8-sig')


# ========== 第一步：加载数据 ==========
print("=" * 60)
print("问题一：单金属A颗粒导通判断")
print("=" * 60)

data_path = os.path.join(DATA_DIR, '附件.xlsx')
df = pd.read_excel(data_path, sheet_name=0)
df.columns = ['X1', 'Y1', 'Z1', 'X2', 'Y2', 'Z2']
# 去掉表头行
if str(df.iloc[0]['X1']).strip() == 'X':
    df = df.iloc[1:].reset_index(drop=True)

for col in df.columns:
    df[col] = pd.to_numeric(df[col])

n_particles = len(df)
print(f"加载 {n_particles} 个金属A颗粒")

# ========== 第二步：逐个分析 ==========
results = []

for i in range(n_particles):
    p1 = np.array([df.iloc[i]['X1'], df.iloc[i]['Y1'], df.iloc[i]['Z1']])
    p2 = np.array([df.iloc[i]['X2'], df.iloc[i]['Y2'], df.iloc[i]['Z2']])

    # 验证长度
    length = np.linalg.norm(p2 - p1)
    seg_vec = p2 - p1
    direction = seg_vec / length

    # 周期性边界处理：将线段裁剪为有效分段
    segments = segment_periodic_images(p1, p2)

    # 计算到两侧电极的最短距离
    dist_left = cylinder_to_plane_distance(p1, p2, ELECTRODE_LEFT, R_A)
    dist_right = cylinder_to_plane_distance(p1, p2, ELECTRODE_RIGHT, R_A)

    # 导通判定
    conducts = check_conduction([(p1, p2)], None)

    results.append({
        '序号': i + 1,
        'X1': df.iloc[i]['X1'], 'Y1': df.iloc[i]['Y1'], 'Z1': df.iloc[i]['Z1'],
        'X2': df.iloc[i]['X2'], 'Y2': df.iloc[i]['Y2'], 'Z2': df.iloc[i]['Z2'],
        '实际长度_nm': round(length, 2),
        '方向X': round(direction[0], 4),
        '方向Y': round(direction[1], 4),
        '方向Z': round(direction[2], 4),
        '到左电极距离_nm': round(dist_left, 2),
        '到右电极距离_nm': round(dist_right, 2),
        '有效分段数': len(segments),
        '是否导通': '是' if conducts else '否'
    })

    print(f"颗粒{i+1}: 左距离={dist_left:.1f}nm, 右距离={dist_right:.1f}nm, "
          f"分段数={len(segments)}, 导通={'是' if conducts else '否'}")

# ========== 第三步：统计 ==========
result_df = pd.DataFrame(results)
n_conduct = sum(1 for r in results if r['是否导通'] == '是')
prob = n_conduct / n_particles
print(f"\n导通概率: {n_conduct}/{n_particles} = {prob:.2%}")

# 打印统计量
dist_left_arr = np.array([r['到左电极距离_nm'] for r in results])
dist_right_arr = np.array([r['到右电极距离_nm'] for r in results])
print(f"\n到左电极距离: min={dist_left_arr.min():.2f}, max={dist_left_arr.max():.2f}, "
      f"mean={dist_left_arr.mean():.2f}, std={dist_left_arr.std():.2f}")
print(f"到右电极距离: min={dist_right_arr.min():.2f}, max={dist_right_arr.max():.2f}, "
      f"mean={dist_right_arr.mean():.2f}, std={dist_right_arr.std():.2f}")

save_csv(result_df, '问题一判定结果.csv')

# ========== 第四步：绘图 ==========
# 图1：3D散点图 - 颗粒在微构体中的位置
fig = plt.figure(figsize=(10, 8))
ax = fig.add_subplot(111, projection='3d')

# 绘制立方体框架
corners = np.array([
    [-5000, -5000, -5000], [5000, -5000, -5000],
    [5000, 5000, -5000], [-5000, 5000, -5000],
    [-5000, -5000, 5000], [5000, -5000, 5000],
    [5000, 5000, 5000], [-5000, 5000, 5000]
])
edges = [
    (0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),
    (0,4),(1,5),(2,6),(3,7)
]
for e in edges:
    ax.plot3D([corners[e[0]][0], corners[e[1]][0]],
              [corners[e[0]][1], corners[e[1]][1]],
              [corners[e[0]][2], corners[e[1]][2]], 'gray', alpha=0.3, linewidth=0.5)

for i, r in enumerate(results):
    color = 'green' if r['是否导通'] == '是' else 'red'
    ax.scatter(r['X1'], r['Y1'], r['Z1'], c=color, marker='o', s=30, alpha=0.8)
    ax.scatter(r['X2'], r['Y2'], r['Z2'], c=color, marker='s', s=30, alpha=0.8)
    ax.plot([r['X1'], r['X2']], [r['Y1'], r['Y2']], [r['Z1'], r['Z2']],
            c=color, alpha=0.5, linewidth=1)

# 绘制电极面
xx, yy = np.meshgrid([-5000, 5000], [-5000, 5000])
zz = np.zeros_like(xx)
ax.plot_surface(np.full_like(xx, -5000), xx, yy, alpha=0.05, color='blue')
ax.plot_surface(np.full_like(xx, 5000), xx, yy, alpha=0.05, color='blue')

ax.set_xlabel('X (nm)')
ax.set_ylabel('Y (nm)')
ax.set_zlabel('Z (nm)')
ax.set_title('单颗粒导通判定结果图', fontsize=14)
ax.legend(['导通', '不导通'], loc='upper right')
despine(ax)
save_fig(fig, '单颗粒导通判定结果图.png')

# 图2：电极距离分布图
fig, axes = plt.subplots(1, 2, figsize=(12, 5))

# 左电极
colors_left = ['green' if r['是否导通'] == '是' else 'red' for r in results]
axes[0].bar(range(1, n_particles+1), dist_left_arr, color=colors_left, alpha=0.7, edgecolor='white')
axes[0].axhline(y=1.8, color='blue', linestyle='--', linewidth=1, label='隧穿距离1.8nm')
axes[0].set_xlabel('颗粒编号')
axes[0].set_ylabel('距离 (nm)')
axes[0].set_title('各颗粒到左电极表面最短距离')
axes[0].legend()
despine(axes[0])

axes[1].bar(range(1, n_particles+1), dist_right_arr, color=colors_left, alpha=0.7, edgecolor='white')
axes[1].axhline(y=1.8, color='blue', linestyle='--', linewidth=1, label='隧穿距离1.8nm')
axes[1].set_xlabel('颗粒编号')
axes[1].set_ylabel('距离 (nm)')
axes[1].set_title('各颗粒到右电极表面最短距离')
axes[1].legend()
despine(axes[1])

plt.tight_layout()
save_fig(fig, '电极距离分布图.png')

print(f"\n图表已保存至 {FIG_DIR}")
print(f"结果已保存至 {OUT_DIR}")
print("问题一求解完成！")
