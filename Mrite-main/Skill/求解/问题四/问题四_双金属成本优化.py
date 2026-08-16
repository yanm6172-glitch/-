"""
问题四：双金属成本优化
金属A: 1.05元/μm³, 圆柱体, r=30nm, L=5000nm
金属B: 0.05元/μm³, 球体, r=200nm
目标: 导通概率 >= 90%, 最小化总成本
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    CUBE_SIZE, CUBE_HALF, R_A, L_A, R_B, TUNNELING_DIST,
    ELECTRODE_LEFT, ELECTRODE_RIGHT,
    cylinder_to_plane_distance, compute_volume_A, compute_volume_B,
    generate_random_particle_A, generate_random_particle_B, UnionFind,
    segment_to_segment_distance_3d, point_to_segment_distance_periodic
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(BASE_DIR, '图片')
OUT_DIR = os.path.join(BASE_DIR, '结果')
os.makedirs(FIG_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

def despine(ax):
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

def save_fig(fig, name):
    fig.savefig(os.path.join(FIG_DIR, name), bbox_inches='tight')
    plt.close(fig)

def save_csv(df, name):
    df.to_csv(os.path.join(OUT_DIR, name), index=False, encoding='utf-8-sig')


# ========== 双金属导通判定 ==========
def check_conduction_AB(particles_A, particles_B):
    """判定含A和B两种颗粒的微构体是否导通"""
    nA = len(particles_A)
    nB = len(particles_B)
    total = nA + nB
    LEFT = total
    RIGHT = total + 1
    uf = UnionFind(total + 2)

    # 预计算中心
    centers_A = np.array([(p[0]+p[1])/2 for p in particles_A]) if nA > 0 else np.zeros((0,3))
    centers_B = np.array(particles_B) if nB > 0 else np.zeros((0,3))

    # 电极连接 - A
    for i, (p1, p2) in enumerate(particles_A):
        if cylinder_to_plane_distance(p1, p2, ELECTRODE_LEFT, R_A) <= TUNNELING_DIST:
            uf.union(i, LEFT)
        if cylinder_to_plane_distance(p1, p2, ELECTRODE_RIGHT, R_A) <= TUNNELING_DIST:
            uf.union(i, RIGHT)

    # 电极连接 - B
    for i, c in enumerate(particles_B):
        idx = nA + i
        if abs(c[0] - ELECTRODE_LEFT) - R_B <= TUNNELING_DIST:
            uf.union(idx, LEFT)
        if abs(c[0] - ELECTRODE_RIGHT) - R_B <= TUNNELING_DIST:
            uf.union(idx, RIGHT)

    if uf.connected(LEFT, RIGHT):
        return True

    # 空间哈希
    cell_size = 5000.0
    n_cells = max(1, int(CUBE_SIZE / cell_size))
    grid = {}

    def add_to_grid(idx, center, ptype):
        ci = (int((center[0]+CUBE_HALF)/cell_size)%n_cells,
              int((center[1]+CUBE_HALF)/cell_size)%n_cells,
              int((center[2]+CUBE_HALF)/cell_size)%n_cells)
        grid.setdefault(ci, []).append((ptype, idx, center))

    for i in range(nA):
        add_to_grid(i, centers_A[i], 'A')
    for i in range(nB):
        add_to_grid(nA+i, centers_B[i], 'B')

    def dist(p1, p2):
        """计算两颗粒表面距离"""
        t1, i1, c1 = p1
        t2, i2, c2 = p2
        if t1 == 'A' and t2 == 'A':
            d = segment_to_segment_distance_3d(
                particles_A[i1][0], particles_A[i1][1],
                particles_A[i2][0], particles_A[i2][1])
            return d - 2*R_A
        elif t1 == 'B' and t2 == 'B':
            dx = min(abs(c1[0]-c2[0]), CUBE_SIZE-abs(c1[0]-c2[0]))
            dy = min(abs(c1[1]-c2[1]), CUBE_SIZE-abs(c1[1]-c2[1]))
            dz = min(abs(c1[2]-c2[2]), CUBE_SIZE-abs(c1[2]-c2[2]))
            return np.sqrt(dx**2+dy**2+dz**2) - 2*R_B
        else:
            if t1 == 'A':
                pa1, pa2 = particles_A[i1]
                cb = c2
            else:
                pa1, pa2 = particles_A[i2]
                cb = c1
            ax_d = point_to_segment_distance_periodic(cb, pa1, pa2)
            return ax_d - R_A - R_B

    checked = set()
    total_AB = total
    for (cx, cy, cz), cell_ps in grid.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    nx = (cx+dx)%n_cells
                    ny = (cy+dy)%n_cells
                    nz = (cz+dz)%n_cells
                    neighbor = grid.get((nx,ny,nz), [])
                    for p1 in cell_ps:
                        for p2 in neighbor:
                            id1, id2 = p1[1], p2[1]
                            if id1 >= id2:
                                continue
                            pair = (id1, id2)
                            if pair in checked:
                                continue
                            checked.add(pair)
                            if dist(p1, p2) <= TUNNELING_DIST:
                                uf.union(id1, id2)
                                if uf.connected(LEFT, RIGHT):
                                    return True
    return uf.connected(LEFT, RIGHT)


# ========== 主程序 ==========
print("=" * 60)
print("问题四：双金属成本优化")
print("=" * 60, flush=True)

V_A = compute_volume_A()
V_B_val = compute_volume_B()
V_total = CUBE_SIZE ** 3

# 成本计算 (元)
# V_A = 1.4137e7 nm^3 = 1.4137e-2 um^3
# V_B = 3.3510e7 nm^3 = 3.3510e-2 um^3
V_A_um3 = V_A * 1e-9  # nm^3 -> um^3 (wrong, actually 1 um^3 = 10^9 nm^3)
# Wait: 1 um = 1000 nm, so 1 um^3 = 10^9 nm^3
# Actually: 1 um^3 = (1000 nm)^3 = 10^9 nm^3 ✓
V_A_um3_correct = V_A / 1e9  # = 1.4137e-2 um^3 ✓
V_B_um3_correct = V_B_val / 1e9  # = 3.3510e-2 um^3 ✓

COST_A = 1.05  # yuan/um^3
COST_B = 0.05  # yuan/um^3

cost_per_A = COST_A * V_A_um3_correct  # yuan per particle
cost_per_B = COST_B * V_B_um3_correct  # yuan per particle

print(f"V_A = {V_A_um3_correct:.4e} um^3, cost per A = {cost_per_A:.6f} yuan")
print(f"V_B = {V_B_um3_correct:.4e} um^3, cost per B = {cost_per_B:.6f} yuan")
print(f"Cost ratio A/B = {cost_per_A/cost_per_B:.1f}x", flush=True)

# --- 网格搜索 ---
# 基于问题三结果：纯A需要39个达到90%
# 搜索范围：N_A in [0, 40], N_B in [0, 300]
# 粗搜索
print("\n--- 粗网格搜索 ---", flush=True)
N_A_range = list(range(0, 45, 5))  # 0, 5, 10, ..., 40
N_B_range = list(range(0, 350, 50))  # 0, 50, 100, ..., 300

coarse_trials = 100
coarse_results = []

for nA in N_A_range:
    for nB in N_B_range:
        if nA == 0 and nB == 0:
            continue
        n_c = sum(1 for _ in range(coarse_trials)
            if check_conduction_AB(
                [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(nA)]],
                [generate_random_particle_B() for _ in range(nB)]))
        prob = n_c / coarse_trials
        cost = nA * cost_per_A + nB * cost_per_B
        coarse_results.append({'N_A': nA, 'N_B': nB, '概率': prob, '成本': cost})
        print(f"  N_A={nA:3d}, N_B={nB:3d}: prob={prob:.3f}, cost={cost:.6f}", flush=True)

# 筛选满足 >= 90% 的组合，找最低成本
valid_coarse = [r for r in coarse_results if r['概率'] >= 0.90]
if valid_coarse:
    best_coarse = min(valid_coarse, key=lambda r: r['成本'])
    print(f"\n粗搜索最优: N_A={best_coarse['N_A']}, N_B={best_coarse['N_B']}, "
          f"prob={best_coarse['概率']:.3f}, cost={best_coarse['成本']:.6f}", flush=True)
else:
    # 放宽条件：找最高概率的组合
    best_coarse = max(coarse_results, key=lambda r: r['概率'])
    print(f"\n无满足90%的组合, 最高概率: N_A={best_coarse['N_A']}, N_B={best_coarse['N_B']}, "
          f"prob={best_coarse['概率']:.3f}", flush=True)

# --- 精细搜索 (在粗搜索最优附近) ---
print("\n--- 精细搜索 ---", flush=True)
fine_trials = 150
best_nA = best_coarse['N_A']
best_nB = best_coarse['N_B']

# 在最优值附近细化
fine_NA = list(range(max(0, best_nA-10), best_nA+12, 2))
fine_NB = list(range(max(0, best_nB-60), best_nB+70, 20))
fine_results = []

for nA in fine_NA:
    for nB in fine_NB:
        if nA == 0 and nB == 0:
            continue
        n_c = sum(1 for _ in range(fine_trials)
            if check_conduction_AB(
                [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(nA)]],
                [generate_random_particle_B() for _ in range(nB)]))
        prob = n_c / fine_trials
        cost = nA * cost_per_A + nB * cost_per_B
        fine_results.append({'N_A': nA, 'N_B': nB, '概率': prob, '成本': cost})
        print(f"  N_A={nA:3d}, N_B={nB:3d}: prob={prob:.3f}, cost={cost:.6f}", flush=True)

# 最佳组合
all_results = coarse_results + fine_results
valid_all = [r for r in all_results if r['概率'] >= 0.90]

if valid_all:
    best = min(valid_all, key=lambda r: r['成本'])
else:
    best = max(all_results, key=lambda r: r['概率'])

print(f"\n全局最优: N_A={best['N_A']}, N_B={best['N_B']}, "
      f"prob={best['概率']:.3f}, cost={best['成本']:.6f} yuan", flush=True)

# 与纯A方案对比
pure_A_N = 39  # 从问题三
pure_A_cost = pure_A_N * cost_per_A
print(f"纯A方案: {pure_A_N}颗粒, cost={pure_A_cost:.6f} yuan")
print(f"节省: {(pure_A_cost - best['成本'])/pure_A_cost*100:.1f}%", flush=True)

# --- 大样本验证最优组合 ---
print("\n--- 验证最优组合 ---", flush=True)
verify_trials = 500
n_c_v = sum(1 for _ in range(verify_trials)
    if check_conduction_AB(
        [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(best['N_A'])]],
        [generate_random_particle_B() for _ in range(best['N_B'])]))
prob_v = n_c_v / verify_trials
std_v = np.sqrt(prob_v*(1-prob_v)/verify_trials)
print(f"验证: {n_c_v}/{verify_trials}={prob_v:.4f}+/-{std_v:.4f}", flush=True)

# 保存结果
import pandas as pd
save_csv(pd.DataFrame(all_results), '问题四网格搜索.csv')
best_df = pd.DataFrame([{
    '最优N_A': best['N_A'], '最优N_B': best['N_B'],
    '导通概率': f"{prob_v:.4f}", '总成本_yuan': f"{best['成本']:.6f}",
    '纯A成本_yuan': f"{pure_A_cost:.6f}", '节省比例': f"{(pure_A_cost-best['成本'])/pure_A_cost*100:.1f}%",
    '填充率_A': f"{best['N_A']*V_A/V_total:.4%}",
    '填充率_B': f"{best['N_B']*V_B_val/V_total:.4%}",
    '总填充率': f"{(best['N_A']*V_A+best['N_B']*V_B_val)/V_total:.4%}"
}])
save_csv(best_df, '问题四最优配置.csv')

# --- 绘图 ---
# 图1: 成本热力图 (粗网格)
fig, ax = plt.subplots(figsize=(10, 8))
# 构建二维矩阵
NA_uniq = sorted(set(r['N_A'] for r in coarse_results))
NB_uniq = sorted(set(r['N_B'] for r in coarse_results))
cost_matrix = np.zeros((len(NA_uniq), len(NB_uniq)))
prob_matrix = np.zeros((len(NA_uniq), len(NB_uniq)))
for r in coarse_results:
    i = NA_uniq.index(r['N_A'])
    j = NB_uniq.index(r['N_B'])
    cost_matrix[i, j] = r['成本']
    prob_matrix[i, j] = r['概率']

# 标记 >= 90% 的区域
im = ax.imshow(prob_matrix, origin='lower', aspect='auto', cmap='RdYlGn', vmin=0, vmax=1)
ax.set_xticks(range(len(NB_uniq))); ax.set_xticklabels(NB_uniq, rotation=45)
ax.set_yticks(range(len(NA_uniq))); ax.set_yticklabels(NA_uniq)
ax.set_xlabel('N_B (球体数量)'); ax.set_ylabel('N_A (圆柱体数量)')
ax.set_title('导通概率热力图 (粗搜索)')
plt.colorbar(im, ax=ax, label='导通概率')

# 标出90%等值线
X, Y = np.meshgrid(range(len(NB_uniq)), range(len(NA_uniq)))
cs = ax.contour(X, Y, prob_matrix, levels=[0.90], colors='blue', linewidths=2)
ax.clabel(cs, fmt='%.0f%%')
# 标出最优点
best_i = NA_uniq.index(min(NA_uniq, key=lambda x: abs(x-best['N_A'])))
best_j = NB_uniq.index(min(NB_uniq, key=lambda x: abs(x-best['N_B'])))
ax.plot(best_j, best_i, 'b*', markersize=20)
save_fig(fig, '成本热力图.png')

# 图2: 纯A vs 最优混合 成本对比
fig, ax = plt.subplots(figsize=(8, 5))
costs = [pure_A_cost, best['成本']]
labels = [f'纯金属A\n({pure_A_N}颗粒)', f'最优混合\n(A={best["N_A"]}, B={best["N_B"]})']
colors = ['#d7191c', '#2c7bb6']
ax.bar(labels, costs, color=colors, edgecolor='white', lw=2)
ax.set_ylabel('总成本 (元)')
ax.set_title('纯金属A vs 最优混合方案成本对比')
for i, (c, l) in enumerate(zip(costs, labels)):
    ax.text(i, c + max(costs)*0.02, f'{c:.6f}', ha='center', fontweight='bold')
despine(ax); save_fig(fig, '成本对比图.png')

# 图3: 固定N_A的最优N_B
fig, ax = plt.subplots(figsize=(8, 5))
for nA in [0, 5, 10, 15, 20, 30, 40]:
    subset = [(r['N_B'], r['概率']) for r in coarse_results if r['N_A'] == nA]
    if subset:
        nbs, probs = zip(*sorted(subset))
        ax.plot(nbs, probs, 'o-', lw=1.5, ms=5, label=f'N_A={nA}')
ax.axhline(y=0.90, color='gray', ls='--')
ax.set_xlabel('N_B'); ax.set_ylabel('导通概率')
ax.set_title('不同N_A下N_B对导通概率的影响')
ax.legend(fontsize=8); ax.grid(alpha=0.3, linestyle='--')
despine(ax); save_fig(fig, 'NA_NB_概率曲线.png')

# 图4: 3D可视化最优配置
fig = plt.figure(figsize=(10, 8))
ax = fig.add_subplot(111, projection='3d')
for p1, p2 in [generate_random_particle_A() for _ in range(min(best['N_A'], 80))]:
    ax.plot([p1[0],p2[0]],[p1[1],p2[1]],[p1[2],p2[2]],'b-',alpha=0.3,lw=0.5)
for c in [generate_random_particle_B() for _ in range(min(best['N_B'], 100))]:
    ax.scatter(*c, s=20, c='orange', alpha=0.5, edgecolors='none')
xx, yy = np.meshgrid([-5000,5000],[-5000,5000])
ax.plot_surface(np.full_like(xx,-5000),xx,yy,alpha=0.05,color='blue')
ax.plot_surface(np.full_like(xx,5000),xx,yy,alpha=0.05,color='red')
ax.set_xlabel('X(nm)'); ax.set_ylabel('Y(nm)'); ax.set_zlabel('Z(nm)')
ax.set_title(f'最优配置 A={best["N_A"]}, B={best["N_B"]}')
save_fig(fig, '最优配置3D分布.png')

print(f"\n图表已保存至 {FIG_DIR}")
print(f"结果已保存至 {OUT_DIR}")
print("问题四求解完成！", flush=True)
