"""
问题二：多金属A颗粒不同填充率下的导通概率（优化版）
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')
import time

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
    clamp_to_cube, segment_to_segment_distance_3d,
    cylinder_to_plane_distance, compute_volume_A, compute_volume_B,
    generate_random_particle_A, generate_random_particle_B, UnionFind
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
    fig.savefig(os.path.join(FIG_DIR, name), bbox_inches='tight')
    plt.close(fig)

def save_csv(df, name):
    df.to_csv(os.path.join(OUT_DIR, name), index=False, encoding='utf-8-sig')


# ========== 优化的导通判定 ==========
def check_conduction_opt(particles_A, return_clusters=False):
    """
    优化的导通判定：使用空间哈希 + 轴对齐包围盒预过滤。
    两个圆柱体可能连接的最大中心距离 ≈ 5000 + 2*30 + 2 = 5062nm
    """
    n = len(particles_A)
    if n == 0:
        return False

    # 预计算中心和包围盒
    centers = np.zeros((n, 3))
    bbox_min = np.zeros((n, 3))
    bbox_max = np.zeros((n, 3))

    for i, (p1, p2) in enumerate(particles_A):
        centers[i] = (p1 + p2) / 2
        # 包围盒：考虑圆柱长度+半径的扩展
        bbox_min[i] = np.minimum(p1, p2) - R_A - TUNNELING_DIST
        bbox_max[i] = np.maximum(p1, p2) + R_A + TUNNELING_DIST

    uf = UnionFind(n + 2)
    LEFT = n
    RIGHT = n + 1

    # 电极连接
    for i, (p1, p2) in enumerate(particles_A):
        dl = cylinder_to_plane_distance(p1, p2, ELECTRODE_LEFT, R_A)
        dr = cylinder_to_plane_distance(p1, p2, ELECTRODE_RIGHT, R_A)
        if dl <= TUNNELING_DIST:
            uf.union(i, LEFT)
        if dr <= TUNNELING_DIST:
            uf.union(i, RIGHT)

    if uf.connected(LEFT, RIGHT):
        return True

    # 空间哈希网格
    cell_size = 5000.0  # 用稍大的cell确保覆盖最大交互距离
    n_cells = max(1, int(CUBE_SIZE / cell_size))

    grid = {}  # (ix, iy, iz) -> [indices]
    for i in range(n):
        ci = (int((centers[i,0] + CUBE_HALF) / cell_size) % n_cells,
              int((centers[i,1] + CUBE_HALF) / cell_size) % n_cells,
              int((centers[i,2] + CUBE_HALF) / cell_size) % n_cells)
        grid.setdefault(ci, []).append(i)

    # 检查颗粒间连接 - 仅检查相邻cell
    def aabb_overlap(i, j):
        """检查两个AABB是否可能重叠（考虑周期性）"""
        for d in range(3):
            if bbox_max[i,d] < bbox_min[j,d] - CUBE_SIZE or \
               bbox_min[i,d] > bbox_max[j,d] + CUBE_SIZE:
                continue
            # 有重叠可能
            di = abs(centers[i,d] - centers[j,d])
            di = min(di, CUBE_SIZE - di)
            max_reach = (bbox_max[i,d] - bbox_min[i,d] + bbox_max[j,d] - bbox_min[j,d]) / 2
            if di <= max_reach + 100:
                return True
        return False

    checked_pairs = set()
    for (cx, cy, cz), cell_indices in grid.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    nx = (cx + dx) % n_cells
                    ny = (cy + dy) % n_cells
                    nz = (cz + dz) % n_cells
                    neighbor = grid.get((nx, ny, nz), [])

                    for i in cell_indices:
                        for j in neighbor:
                            if i >= j:
                                continue
                            pair = (i, j)
                            if pair in checked_pairs:
                                continue
                            checked_pairs.add(pair)

                            if not aabb_overlap(i, j):
                                continue

                            d = segment_to_segment_distance_3d(
                                particles_A[i][0], particles_A[i][1],
                                particles_A[j][0], particles_A[j][1])
                            surf_d = d - 2 * R_A
                            if surf_d <= TUNNELING_DIST:
                                uf.union(i, j)
                                if uf.connected(LEFT, RIGHT):
                                    return True

    return uf.connected(LEFT, RIGHT)


# ========== 主程序 ==========
print("=" * 60)
print("问题二：多金属A颗粒蒙特卡洛模拟")
print("=" * 60, flush=True)

V_A = compute_volume_A()
V_total = CUBE_SIZE ** 3

# --- Part 1: 附件2固定配置 ---
data_path = os.path.join(DATA_DIR, '附件.xlsx')
df2 = pd.read_excel(data_path, sheet_name=1)
df2.columns = ['X1', 'Y1', 'Z1', 'X2', 'Y2', 'Z2']
if str(df2.iloc[0]['X1']).strip() == 'X':
    df2 = df2.iloc[1:].reset_index(drop=True)
for col in df2.columns:
    df2[col] = pd.to_numeric(df2[col])

n_fixed = len(df2)
particles_fixed = []
for i in range(n_fixed):
    p1 = np.array(df2.iloc[i][['X1','Y1','Z1']])
    p2 = np.array(df2.iloc[i][['X2','Y2','Z2']])
    particles_fixed.append((p1, p2))

fr_fixed = n_fixed * V_A / V_total
conducts_fixed = check_conduction_opt(particles_fixed)

print(f"附件2: {n_fixed}颗粒, 填充率={fr_fixed:.4%}, 导通={'是' if conducts_fixed else '否'}", flush=True)

# 连通性详细分析
uf = UnionFind(n_fixed + 2)
LEFT, RIGHT = n_fixed, n_fixed + 1
for i, (p1, p2) in enumerate(particles_fixed):
    if cylinder_to_plane_distance(p1, p2, ELECTRODE_LEFT, R_A) <= TUNNELING_DIST:
        uf.union(i, LEFT)
    if cylinder_to_plane_distance(p1, p2, ELECTRODE_RIGHT, R_A) <= TUNNELING_DIST:
        uf.union(i, RIGHT)

n_conn = 0
for i in range(n_fixed):
    for j in range(i+1, n_fixed):
        d = segment_to_segment_distance_3d(
            particles_fixed[i][0], particles_fixed[i][1],
            particles_fixed[j][0], particles_fixed[j][1]) - 2*R_A
        if d <= TUNNELING_DIST:
            uf.union(i, j)
            n_conn += 1

roots = set(uf.find(i) for i in range(n_fixed))
print(f"连接对数: {n_conn}, 连通簇数: {len(roots)}", flush=True)

# --- Part 2: Monte Carlo ---
print("\n--- 蒙特卡洛模拟 ---", flush=True)
fill_ratios = [0.0050, 0.0060, 0.0070, 0.0100]
mc_trials = 200
mc_results = []

for fr in fill_ratios:
    N = max(1, int(fr * V_total / V_A))
    print(f"填充率 {fr:.2%} (N={N}): ", end='', flush=True)
    t0 = time.time()

    n_conduct = 0
    for trial in range(mc_trials):
        parts = [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(N)]]
        if check_conduction_opt(parts):
            n_conduct += 1
        if (trial + 1) % 50 == 0:
            print(f"{trial+1}..", end='', flush=True)

    prob = n_conduct / mc_trials
    std_err = np.sqrt(prob * (1 - prob) / mc_trials)
    elapsed = time.time() - t0
    print(f" 完成! {n_conduct}/{mc_trials} = {prob:.4f} +/- {std_err:.4f} ({elapsed:.1f}s)", flush=True)

    mc_results.append({
        '填充率': f'{fr:.2%}',
        '颗粒数N': N,
        '模拟次数': mc_trials,
        '导通次数': n_conduct,
        '导通概率': f'{prob:.4f}',
        '标准误差': f'{std_err:.4f}'
    })

# --- Part 3: 图表 ---
fixed_df = pd.DataFrame([{'颗粒数': n_fixed, '填充率': f'{fr_fixed:.4%}',
    '连接对数': n_conn, '连通簇数': len(roots),
    '是否导通': '是' if conducts_fixed else '否'}])
save_csv(fixed_df, '附件2配置分析.csv')

mc_df = pd.DataFrame(mc_results)
save_csv(mc_df, '问题二结果汇总.csv')

# 图1: 导通概率 vs 填充率
fig, ax = plt.subplots(figsize=(8, 5))
probs = [float(r['导通概率']) for r in mc_results]
frs_label = [r['填充率'] for r in mc_results]
ax.plot(frs_label, probs, 'o-', color='#2c7bb6', lw=2, ms=10, mfc='white', mew=2)
ax.set_xlabel('填充率'); ax.set_ylabel('导通概率')
ax.set_title('导通概率随填充率变化曲线')
ax.set_ylim(0, 1.05); ax.grid(alpha=0.3, linestyle='--')
despine(ax); save_fig(fig, '导通概率vs填充率曲线.png')

# 图2: 颗粒数 vs 填充率
fig, ax = plt.subplots(figsize=(8, 5))
N_vals = [r['颗粒数N'] for r in mc_results]
ax.bar(frs_label, N_vals, color='#abd9e9', edgecolor='#2c7bb6', lw=1.5)
ax.set_xlabel('填充率'); ax.set_ylabel('金属A颗粒数量')
ax.set_title('不同填充率对应的金属A颗粒数')
for i, nv in enumerate(N_vals):
    ax.text(i, nv+10, str(nv), ha='center')
despine(ax); save_fig(fig, '颗粒数vs填充率.png')

# 图3: 导通概率柱状图对比
fig, ax = plt.subplots(figsize=(8, 5))
colors = ['#fdae61', '#abd9e9', '#2c7bb6', '#d7191c']
errors = [2*float(r['标准误差']) for r in mc_results]
ax.bar(frs_label, probs, yerr=errors, color=colors, edgecolor='white', lw=1.5, capsize=5)
ax.set_xlabel('填充率'); ax.set_ylabel('导通概率')
ax.set_title('各填充率导通概率对比')
ax.set_ylim(0, 1.05); ax.grid(alpha=0.3, linestyle='--', axis='y')
for i, p in enumerate(probs):
    ax.text(i, p+0.03, f'{p:.3f}', ha='center', fontweight='bold')
despine(ax); save_fig(fig, '导通概率对比柱状图.png')

# 图4: 附件2 3D可视化
fig = plt.figure(figsize=(10, 8))
ax = fig.add_subplot(111, projection='3d')
for i, (p1, p2) in enumerate(particles_fixed):
    ax.plot([p1[0],p2[0]],[p1[1],p2[1]],[p1[2],p2[2]], 'b-', alpha=0.3, lw=0.5)
    c = (p1+p2)/2
    ax.scatter(*c, s=5, c='blue', alpha=0.5)
ax.set_xlabel('X (nm)'); ax.set_ylabel('Y (nm)'); ax.set_zlabel('Z (nm)')
ax.set_title('附件2颗粒空间分布')
save_fig(fig, '附件2配置连通图.png')

# 图5: 收敛曲线演示 (1.00%填充率)
fig, ax = plt.subplots(figsize=(8, 5))
N_demo = max(1, int(0.01 * V_total / V_A))
demo_n, demo_c = 0, 0
demo_probs = []
for trial in range(100):
    parts = [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(N_demo)]]
    if check_conduction_opt(parts):
        demo_c += 1
    demo_n += 1
    demo_probs.append(demo_c / demo_n)

ax.plot(range(1, 101), demo_probs, '-', color='#d7191c', lw=1.5)
ax.axhline(y=demo_probs[-1], color='gray', ls='--', alpha=0.5)
ax.set_xlabel('模拟次数'); ax.set_ylabel('导通概率')
ax.set_title(f'蒙特卡洛收敛曲线 (1.00%, N={N_demo})')
ax.grid(alpha=0.3, linestyle='--')
despine(ax); save_fig(fig, '蒙特卡洛收敛图.png')

# 图6: 电极接触颗粒可视化
fig, ax = plt.subplots(figsize=(8, 5))
left_touching = sum(1 for p1, p2 in particles_fixed
                    if cylinder_to_plane_distance(p1, p2, ELECTRODE_LEFT, R_A) <= TUNNELING_DIST)
right_touching = sum(1 for p1, p2 in particles_fixed
                     if cylinder_to_plane_distance(p1, p2, ELECTRODE_RIGHT, R_A) <= TUNNELING_DIST)
ax.bar(['左电极', '右电极'], [left_touching, right_touching], color=['#2c7bb6','#d7191c'], edgecolor='white')
ax.set_ylabel('接触颗粒数')
ax.set_title(f'附件2配置电极接触情况 (共{n_fixed}颗粒)')
for i, v in enumerate([left_touching, right_touching]):
    ax.text(i, v+0.5, str(v), ha='center', fontweight='bold')
despine(ax); save_fig(fig, '电极接触情况.png')

print(f"\n图表已保存至 {FIG_DIR}")
print(f"结果已保存至 {OUT_DIR}")
print("问题二求解完成！", flush=True)
