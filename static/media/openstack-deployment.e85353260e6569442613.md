
## Table of Contents

1. [Introduction](#introduction)
2. [The Goal](#the-goal)
3. [Architecture Overview](#architecture-overview)
4. [Phase 1: Environment Setup](#phase-1-environment-setup)
5. [Phase 2: DevStack Installation](#phase-2-devstack-installation)
6. [Phase 3: The ARM CPU Architecture Challenge](#phase-3-the-arm-cpu-architecture-challenge)
7. [Phase 4: Networking Configuration](#phase-4-networking-configuration)
8. [Phase 5: The NAT Routing Problem](#phase-5-the-nat-routing-problem)
9. [Phase 6: Creating Real Workloads](#phase-6-creating-real-workloads)
10. [Key Concepts Learned](#key-concepts-learned)
11. [Troubleshooting Summary](#troubleshooting-summary)
12. [Lessons Learned](#lessons-learned)
13. [Final Thoughts](#final-thoughts)

---

## Introduction

As a Cloud Native Developer working with OpenStack and KVM infrastructure, I wanted to understand the underlying technology better. This blog post chronicles my journey setting up OpenStack DevStack on an Apple Silicon MacBook—a journey filled with learning, troubleshooting, and valuable insights into cloud infrastructure.

**Spoiler alert:** It worked, but not without significant challenges!

---

## The Goal

**Primary Objective:** Set up a functional OpenStack environment for learning and experimentation.

**Why this matters:**
- Understanding how cloud infrastructure works at a fundamental level
- Learning OpenStack architecture and components
- Gaining hands-on experience with virtualization, networking, and troubleshooting
- Preparing for real-world cloud infrastructure work

**Starting Point:**
- MacBook with Apple Silicon (M-series chip)
- 14 CPU cores, 48GB RAM
- No prior OpenStack experience
- Basic Linux knowledge

---

## Architecture Overview

### The Final Working Architecture

```
MacBook Pro (Apple Silicon M-series)
    └── VMware Fusion (Type 2 Hypervisor)
        └── Ubuntu 22.04 ARM64 VM (4 cores, 12GB RAM, 60GB disk)
            └── OpenStack DevStack 2025.1
                └── QEMU Emulation (instead of KVM)
                    └── Guest VMs (Cirros, Fedora)
```

### Why This Stack?

- **Apple Silicon:** ARM architecture instead of x86
- **VMware Fusion:** Supports ARM virtualization on Apple Silicon
- **Ubuntu ARM64:** Required for ARM compatibility
- **QEMU:** Fallback when KVM isn't available (nested virtualization limitation)
- **DevStack:** Single-node OpenStack deployment for development/learning

---

## Phase 1: Environment Setup

### Challenge 1: Architecture Compatibility

**Initial Mistake:**
Downloaded Ubuntu 18.04 x86_64 ISO (as per the guide I was following).

**Error Encountered:**
```
"requires X86 machine architecture, incompatible with ARM host"
```

**Learning:** Apple Silicon uses ARM architecture, not x86. I needed ARM-compatible images.

**Solution:**
- Downloaded Ubuntu 22.04 ARM64 ISO (1.96 GB)
- Created VM in VMware Fusion with ARM64 support

### VM Configuration

```yaml
Processors: 4 cores
Memory: 12 GB
Disk: 60 GB
Network: Bridged (Wi-Fi)
OS: Ubuntu 22.04 ARM64
```

### Ubuntu Installation

**Key Decisions:**
- Username: `stack` (required by DevStack)
- Storage: Single partition, **no LVM** (DevStack requirement)
- SSH: Enabled OpenSSH server
- Packages: Minimal installation

**Post-Installation Setup:**

```bash
# Passwordless sudo for stack user
echo "stack ALL=(ALL:ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/stack

# System update
sudo apt update && sudo apt upgrade -y

# Timezone configuration
sudo timedatectl set-timezone Africa/Nairobi
```

---

## Phase 2: DevStack Installation

### Network Configuration (Static IP)

**Initial Setup:**

```yaml
# /etc/netplan/00-installer-config.yaml
network:
  version: 2
  ethernets:
    ens160:
      addresses: [172.16.145.128/24]
      routes:
        - to: default
          via: 172.16.145.2
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

### DevStack Installation

**Branch Selection:**
- Guide recommended: `stable/victoria` (for Ubuntu 18.04)
- My choice: `stable/2025.1` (latest, supports Ubuntu 22.04 ARM64)

**Installation Commands:**

```bash
cd ~
git clone https://opendev.org/openstack/devstack
cd devstack
git checkout stable/2025.1
```

**Configuration (`local.conf`):**

```ini
[[local|localrc]]
ADMIN_PASSWORD=pw
DATABASE_PASSWORD=pw
RABBIT_PASSWORD=pw
SERVICE_PASSWORD=pw
HOST_IP=172.16.145.128
enable_service h-eng h-api h-api-cfn h-api-cw
LOGFILE=$DEST/logs/stack.sh.log
VERBOSE=True
LOG_COLOR=True
SCREEN_LOGDIR=$DEST/logs/screen
```

**Installation:**

```bash
./stack.sh
# Duration: ~90 minutes
```

**Success Output:**

```
DevStack Version: 2025.1
OS: Ubuntu 22.04 jammy
Horizon: http://172.16.145.128/dashboard
Keystone: http://172.16.145.128/identity/
```

---

## Phase 3: The ARM CPU Architecture Challenge

### The Problem: VMs Wouldn't Boot

**Symptoms:**
- Instance status: `ACTIVE`
- QEMU process: Running 
- Console log: **Completely empty**
- Dashboard console: "Guest has not initialized the display yet"

**Initial Confusion:**
Everything looked fine in OpenStack, but VMs never actually booted. No errors, no logs—just silence.

### Root Cause Discovery

**Diagnostic Process:**

```bash
# Check if VM exists in libvirt
sudo virsh list --all
# Output: instance-00000002 running

# Check QEMU command line
ps aux | grep qemu-system-aarch64 | grep instance

# Found the problem:
-cpu cortex-a15  # ← 32-bit ARM CPU!
```

**The Issue:**
- Nova default for ARM QEMU: `cortex-a15` (32-bit ARMv7)
- Cirros image: `aarch64` (64-bit ARMv8)
- **Result:** Incompatible! VM can't boot 64-bit OS on 32-bit CPU

### The Fix: Configure 64-bit ARM CPU

**Nova Configuration (`/etc/nova/nova-cpu.conf`):**

**Before (Broken):**
```ini
[libvirt]
virt_type = qemu
cpu_mode = none  # Uses default cortex-a15
```

**After (Working):**
```ini
[libvirt]
virt_type = qemu
cpu_mode = custom
cpu_models = cortex-a72  # 64-bit ARM CPU
hw_machine_type = aarch64=virt
live_migration_uri = qemu+ssh://stack@%s/system
```

**Critical Learning:**
- **cortex-a15:** 32-bit ARM (ARMv7)
- **cortex-a72:** 64-bit ARM (ARMv8/AArch64)
- Architecture must match the OS!

**Restart and Test:**

```bash
sudo systemctl restart devstack@n-cpu
openstack server delete old-instance
openstack server create --flavor m1.tiny --image cirros --network private test-vm
```

**Result:** VM boots successfully! Console log shows boot messages! 🎉

---

## Phase 4: Networking Configuration

### Understanding OpenStack Networking

**Network Components:**
- **Private Network:** Internal VM network (10.0.0.0/26)
- **Router:** Connects private to external network
- **External Network:** "Public" network (172.24.4.0/24)
- **Floating IPs:** Public IPs for VM access

### The br-ex Bridge

**Why a bridge?**

```
Multiple services need to share one physical interface:
- SSH traffic (to Ubuntu host)
- OpenStack management
- VM external access

Bridge = Virtual switch that multiplexes traffic
```

**Network Configuration (`/etc/netplan/01-netcfg.yaml`):**

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens160:
      dhcp4: no
      dhcp6: no
  bridges:
    br-ex:
      addresses:
        - 172.16.145.128/24  # Management IP
        - 172.24.4.1/24      # OpenStack external
      routes:
        - to: default
          via: 172.16.145.2
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
      interfaces:
        - ens160
      parameters:
        stp: false
        forward-delay: 0
```

**Disable Cloud-init:**

```bash
echo "network: {config: disabled}" | \
  sudo tee /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
```

### Reboot Persistence

**Problem:** DevStack services don't auto-start after reboot.

**Solution: Restoration Script (`~/restore-after-reboot.sh`):**

```bash
#!/bin/bash
echo "Restoring DevStack services..."
sleep 10

# Remount Swift filesystem
if [ -f /opt/stack/data/swift/drives/images/swift.img ]; then
    sudo mount -t xfs -o loop,noatime,nodiratime,logbufs=8 \
        /opt/stack/data/swift/drives/images/swift.img \
        /opt/stack/data/swift/drives/sdb1 2>/dev/null
fi

# Recreate Cinder loop devices
if [ -f /opt/stack/data/stack-volumes-lvmdriver-1-backing-file ]; then
    sudo losetup /dev/loop0 \
        /opt/stack/data/stack-volumes-lvmdriver-1-backing-file 2>/dev/null
fi

# Restart all DevStack services
sudo systemctl restart 'devstack@*'

echo "DevStack services restored!"
```

**Systemd Service (`/etc/systemd/system/devstack-restore.service`):**

```ini
[Unit]
Description=Restore DevStack after reboot
After=network-online.target

[Service]
Type=oneshot
User=stack
ExecStart=/home/stack/restore-after-reboot.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

**Enable:**

```bash
sudo systemctl enable devstack-restore.service
```

---

## Phase 5: The NAT Routing Problem

### Challenge: VMs Can't Reach Internet

**Symptoms:**
- VM has IP: 10.0.0.36
- Can ping gateway: 10.0.0.1
- Can't ping internet: 8.8.8.8
- DNS doesn't work

### Understanding the Network Flow

**Expected Path:**

```
VM (10.0.0.36)
    ↓ Default route via 10.0.0.1
OpenStack Router (SNAT)
    ↓ Changes source: 10.0.0.36 → 172.24.4.75
br-ex Bridge (172.24.4.75)
    ↓ Should NAT to 172.16.145.128
Ubuntu Host
    ↓ NAT to Mac's network
Internet 
```

**Actual Problem:**
The br-ex → Internet step was missing NAT!

### The Root Cause

**DevStack runs inside a VM:**

```
Mac
└── VMware Fusion
    └── Ubuntu VM (DevStack)
        └── br-ex network (172.24.4.0/24)
            └── OpenStack VMs
```

The 172.24.4.0/24 network is **isolated inside the Ubuntu VM** and has no route to the internet!

### The Solution: Double NAT

**Step 1: Enable IP Forwarding**

```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
```

**Step 2: Add iptables MASQUERADE Rule**

**First Attempt (Failed):**

```bash
sudo iptables -t nat -A POSTROUTING -s 172.24.4.0/24 -o ens160 -j MASQUERADE
```

**Why it failed:**
The `-o ens160` restriction was wrong! Traffic goes through `br-ex`, not `ens160`.

**Diagnostic:**

```bash
ip route show
# Output:
# default via 172.16.145.2 dev br-ex  ← Traffic uses br-ex!
```

**Correct Rule (Working):**

```bash
sudo iptables -t nat -A POSTROUTING -s 172.24.4.0/24 ! -d 172.24.4.0/24 -j MASQUERADE
```

**Key Differences:**
- Removed `-o ens160` (no interface restriction)
- Added `! -d 172.24.4.0/24` (don't NAT internal traffic)
- Works on any outbound interface

**Test:**

```bash
ssh -i demokey.pem fedora@<FLOATING_IP> 'ping -c 3 8.8.8.8'
# Success!
```

### Understanding the NAT Layers

**Complete NAT Flow:**

```
Layer 1: OpenStack SNAT
VM (10.0.0.36) → Router → (172.24.4.75)

Layer 2: Ubuntu Host MASQUERADE
(172.24.4.75) → iptables → (172.16.145.128)

Layer 3: VMware NAT (optional)
(172.16.145.128) → VMware → (Mac's IP)

Layer 4: Mac → Internet
```

---

## Phase 6: Creating Real Workloads

### SSH Keypairs

**Why Keypairs?**

In cloud environments:
- Can't set password before VM boots
- Password authentication is less secure
- Automation requires passwordless access

**How They Work:**

```
1. Create keypair in OpenStack
   → Public key stored in OpenStack
   → Private key downloaded to your computer

2. Create VM with --key-name
   → OpenStack injects public key into VM
   → VM configures SSH to accept key authentication

3. SSH with private key
   → No password needed!
```

**Create Keypair:**

```bash
openstack keypair create demokey > demokey.pem
chmod 400 demokey.pem
```

**Use with VM:**

```bash
openstack server create wpinstance \
  --image fedora \
  --flavor m1.small \
  --network private \
  --key-name demokey
```

**SSH Access:**

```bash
ssh -i demokey.pem fedora@<FLOATING_IP>
# No password prompt! 
```

### Floating IPs

**What is a Floating IP?**

A floating IP is like a public IP address that you can attach to VMs.

```
Private IP (10.0.0.3) = Apartment number
Floating IP (172.24.4.126) = Building's street address
```

**Without Floating IP:**

```
VM: 10.0.0.3 (private, not routable)
You: Can't SSH directly (no route)
```

**With Floating IP:**

```
VM: 10.0.0.3 + Floating IP 172.24.4.126
Router: Does NAT (172.24.4.126 → 10.0.0.3)
You: Can SSH to 172.24.4.126!
```

**Create and Assign:**

```bash
# Create floating IP
openstack floating ip create public

# Assign to VM
openstack server add floating ip test-vm 172.24.4.126

# SSH access
ssh cirros@172.24.4.126
```

### Security Groups

**What are Security Groups?**

Security groups are virtual firewalls for VMs.

**Default Behavior:**
- Outbound: Allowed
- Inbound: Blocked

**Add Rules:**

```bash
# Allow SSH (port 22)
openstack security group rule create default \
  --protocol tcp \
  --dst-port 22 \
  --remote-ip 0.0.0.0/0

# Allow ICMP (ping)
openstack security group rule create default \
  --protocol icmp \
  --remote-ip 0.0.0.0/0

# Allow HTTP (port 80)
openstack security group rule create web \
  --protocol tcp \
  --dst-port 80
```

---

## Key Concepts Learned

### 1. Virtualization Layers

**Hypervisor Types:**

```
Type 1 (Bare Metal):
Hardware → Hypervisor → VMs
Examples: VMware ESXi, KVM (on bare metal)

Type 2 (Hosted):
Hardware → OS → Hypervisor → VMs
Examples: VMware Fusion, VirtualBox
```

**My Setup:**

```
Type 2: VMware Fusion (runs on macOS)
    └── Contains: Ubuntu VM
        └── Type 1 concept: KVM/QEMU (runs on Linux)
            └── Contains: OpenStack VMs

This is "nested virtualization"!
```

### 2. KVM vs QEMU

**KVM (Kernel-based Virtual Machine):**
- Requires CPU virtualization support
- Hardware-accelerated
- Very fast (near-native performance)
- Needs /dev/kvm device

**QEMU (Quick Emulator):**
- Software emulation
- No special CPU requirements
- Slower (10-20x slower than KVM)
- Works anywhere

**Why I Used QEMU:**

```
Apple Silicon + VMware Fusion:
→ Limited nested virtualization support for ARM
→ /dev/kvm not available
→ KVM can't load
→ Fallback to QEMU 
```

**Trade-off:**
- VMs work
Very slow (Cirros boots in 30-60 sec vs 5-10 sec with KVM)

### 3. CPU Architecture Compatibility

**The Lesson:**

```
32-bit ARM (ARMv7):
- CPUs: cortex-a7, cortex-a9, cortex-a15
- Can ONLY run 32-bit ARM operating systems

64-bit ARM (ARMv8/AArch64):
- CPUs: cortex-a53, cortex-a57, cortex-a72
- Can run 64-bit ARM operating systems
- Can also run 32-bit (backward compatible)
```

**My Issue:**
- Nova default: cortex-a15 (32-bit)
- Cirros image: aarch64 (64-bit)
- **Incompatible!**

**Critical Rule:**
OS architecture must match (or be lower than) CPU architecture!

### 4. OpenStack Multi-Tenancy

**Projects = Isolation:**

```
One OpenStack Cloud
├── Project: demo
│   ├── VMs: test-vm, wpinstance
│   ├── Networks: private
│   └── Users: demo (member)
│
├── Project: titan
│   ├── VMs: (none)
│   ├── Networks: (none)
│   └── Users: demo (member)
│
└── Project: admin
    ├── Purpose: Manage OpenStack
    └── Users: admin (admin role)
```

**Key Points:**
- Projects isolate resources
- Users need explicit membership
- Creating a project ≠ being a member
- Even admin needs to be added to projects!

### 5. Network Address Translation (NAT)

**SNAT (Source NAT):**

```
Changes source IP of outgoing packets

VM sends: Source 10.0.0.3 → Destination 8.8.8.8
Router SNAT: Source 172.24.4.75 → Destination 8.8.8.8
Internet sees: Traffic from 172.24.4.75
```

**DNAT (Destination NAT):**

```
Changes destination IP of incoming packets

Internet sends: Source 8.8.8.8 → Destination 172.24.4.75
Router DNAT: Source 8.8.8.8 → Destination 10.0.0.3
VM receives: Traffic from 8.8.8.8
```

**Floating IPs use DNAT!**

### 6. iptables and Packet Filtering

**MASQUERADE:**

```
Dynamic SNAT that uses outgoing interface's IP

Rule:
iptables -t nat -A POSTROUTING -s 172.24.4.0/24 ! -d 172.24.4.0/24 -j MASQUERADE

Translation:
"For packets FROM 172.24.4.0/24 NOT going TO 172.24.4.0/24,
 change source IP to match outgoing interface"
```

**Why `! -d 172.24.4.0/24`?**

```
VM to Internet:
Source: 172.24.4.75, Dest: 8.8.8.8
→ Not in 172.24.4.0/24 → MASQUERADE 

VM to VM:
Source: 172.24.4.75, Dest: 172.24.4.126
→ Is in 172.24.4.0/24 → Don't MASQUERADE 
```

Keeps internal traffic internal!

### 7. Network Bridges

**What is a Bridge?**

```
A bridge is a virtual network switch that connects multiple interfaces

Physical Interface (ens160)
    ↓
Bridge (br-ex)
    ├→ SSH traffic
    ├→ OpenStack management
    └→ VM external access

All share one physical connection!
```

**Why Use Bridges?**
- Share one physical NIC among multiple services
- OpenStack external network needs dedicated interface
- Management access needs to work simultaneously

---

## Troubleshooting Summary

### Issue 1: VM Won't Boot (Empty Console Log)

**Symptoms:**
- Instance ACTIVE
- QEMU running
- Console log empty
- No errors

**Diagnosis:**

```bash
ps aux | grep qemu | grep instance
# Found: -cpu cortex-a15
```

**Root Cause:** 32-bit CPU, 64-bit OS

**Solution:**

```ini
[libvirt]
cpu_mode = custom
cpu_models = cortex-a72
```

**Lesson:** Check CPU architecture compatibility!

---

### Issue 2: Can't SSH to VM ("No route to host")

**Symptoms:**
- VM has IP
- Ping to VM fails
- SSH fails

**Diagnosis:**

```bash
openstack security group rule list default
# No SSH or ICMP rules!
```

**Root Cause:** Security groups blocking inbound traffic

**Solution:**

```bash
openstack security group rule create default --protocol tcp --dst-port 22
openstack security group rule create default --protocol icmp
```

**Lesson:** Security groups block everything inbound by default!

---

### Issue 3: VM Can't Reach Internet

**Symptoms:**
- VM can ping gateway
- VM can't ping 8.8.8.8
- No internet access

**Diagnosis:**

```bash
# Check router SNAT
openstack router show router1 | grep snat
# enable_snat: true 

# Check if br-ex can reach internet
ping -c 3 -I br-ex 8.8.8.8
# Works! 

# Check from VM
ssh -i key.pem user@vm 'ping 8.8.8.8'
# Fails! 
```

**Root Cause:** Missing NAT from br-ex network to external network

**Solution:**

```bash
sudo iptables -t nat -A POSTROUTING -s 172.24.4.0/24 ! -d 172.24.4.0/24 -j MASQUERADE
```

**Lesson:** DevStack in a VM needs manual NAT configuration!

---

### Issue 4: DNS Resolution Fails

**Symptoms:**
- Ping 8.8.8.8 works
- Ping google.com fails
- "Temporary failure in name resolution"

**Diagnosis:**

```bash
cat /etc/resolv.conf
# nameserver 127.0.0.53 (systemd-resolved)
```

**Root Cause:** systemd-resolved not working properly

**Solution:**

```bash
resolvectl dns eth0 8.8.8.8 1.1.1.1
# or
rm /etc/resolv.conf
echo "nameserver 8.8.8.8" > /etc/resolv.conf
```

**Lesson:** Cloud VMs often need manual DNS configuration!

---

### Issue 5: Dashboard Console Won't Accept Input

**Symptoms:**
- Console shows login prompt
- Can't type in console
- Mouse cursor won't enter

**Diagnosis:**
- Browser compatibility issues
- noVNC keyboard capture problems

**Solution:**

```bash
# Get direct VNC URL
openstack console url show instance-name

# Open in browser
# Or use SSH instead:
ssh -i key.pem user@floating-ip
```

**Lesson:** VNC consoles can be finicky; SSH is more reliable!

---

## Lessons Learned

### Technical Lessons

1. **Architecture Matters**
    - ARM ≠ x86
    - 32-bit ≠ 64-bit
    - Always check compatibility!

2. **Nested Virtualization is Tricky**
    - Apple Silicon has limited support
    - QEMU is slow but works
    - Production uses bare-metal KVM

3. **Networking is Complex**
    - Multiple NAT layers
    - Bridge configuration
    - Security groups
    - Floating IPs

4. **OpenStack Has Many Moving Parts**
    - Keystone (identity)
    - Nova (compute)
    - Neutron (networking)
    - Glance (images)
    - Cinder (volumes)
    - Horizon (dashboard)

5. **Configuration Persistence Requires Work**
    - DevStack is for development
    - Production needs proper deployment (Kolla-Ansible)
    - Reboot survival needs custom scripts

### Problem-Solving Lessons

1. **Read the Logs**
   ```bash
   # Console logs are invaluable
   openstack console log show instance
   
   # Service logs show errors
   sudo journalctl -u devstack@n-cpu
   ```

2. **Check Every Layer**
   ```
   Application layer (VM OS)
   ↓
   OpenStack layer (Nova, Neutron)
   ↓
   Hypervisor layer (QEMU)
   ↓
   Host OS layer (Ubuntu)
   ↓
   Virtualization layer (VMware)
   ↓
   Hardware layer (Mac)
   ```

3. **Understand the Expected Flow**
    - Draw network diagrams
    - Trace packet paths
    - Verify each hop

4. **Compare What Works vs What Doesn't**
   ```bash
   # br-ex can ping internet → Ubuntu networking works
   # VM can't ping internet → OpenStack networking issue
   ```

5. **Google is Your Friend, But Understand the Context**
    - Generic solutions may not apply to ARM
    - DevStack ≠ production OpenStack
    - Your setup is unique (nested ARM virtualization)

### Practical Lessons

1. **Performance Expectations**
    - QEMU on ARM is SLOW
    - VM boot: 30-60 seconds (vs 5-10 with KVM)
    - Package installation: 10-20x slower
    - Set realistic expectations!

2. **When to Stop**
    - WordPress installation taking hours
    - QEMU limitations hit
    - Learning objectives already achieved
    - **Know when to call it success!**

3. **Documentation is Key**
    - Save configurations
    - Document troubleshooting steps


---

## Key Commands Reference

### OpenStack Basics

```bash
# Authentication
source ~/devstack/openrc demo demo  # Switch to demo user
source ~/devstack/openrc admin admin  # Switch to admin

# Images
openstack image list
openstack image create --file image.qcow2 --disk-format qcow2 --public fedora

# Instances
openstack server create --flavor m1.tiny --image cirros --network private vm1
openstack server list
openstack server show vm1
openstack server delete vm1
openstack console log show vm1
openstack console url show vm1

# Networking
openstack network list
openstack router list
openstack floating ip create public
openstack server add floating ip vm1 172.24.4.50

# Security Groups
openstack security group list
openstack security group rule list default
openstack security group rule create default --protocol tcp --dst-port 22

# Keypairs
openstack keypair create mykey > mykey.pem
chmod 400 mykey.pem
openstack keypair list
```

### Troubleshooting

```bash
# Check services
sudo systemctl status 'devstack@*' | grep Active
openstack compute service list
openstack network agent list

# Check hypervisor
openstack hypervisor list
openstack hypervisor show devstack

# Restart services
sudo systemctl restart devstack@n-cpu
sudo systemctl restart devstack@q-svc

# Check OVN
sudo ovn-nbctl show
sudo ovn-sbctl show
sudo ovn-nbctl lr-nat-list neutron-<router-id>

# Network debugging
ip addr show
ip route show
sudo iptables -t nat -L -n -v
ping -c 3 -I br-ex 8.8.8.8
```

---

## Final Thoughts

### What I Accomplished

**Infrastructure:**
- Set up OpenStack on Apple Silicon
- Configured nested virtualization with QEMU
- Built production-like networking

**Problem Solving:**
- Diagnosed ARM CPU architecture issues
- Fixed complex NAT routing problems
- Troubleshot through multiple layers

**Learning:**
- Understood OpenStack architecture
- Mastered networking concepts
- Gained practical cloud infrastructure experience

### What I Would Do Differently

1. **Use Intel-based hardware** for better KVM support (if available)
2. **Start with simpler exercises** before attempting full applications
3. **Set performance expectations early** (QEMU limitations)
4. **Document as I go** rather than reconstructing later

### Is It Worth It?

**Absolutely!**

Even though:
- The setup took longer than expected
- QEMU performance was frustratingly slow
- WordPress installation didn't complete

**I learned more than any tutorial could teach:**
- Real troubleshooting skills
- Deep understanding of networking
- Hands-on experience with complex systems
- Confidence to tackle infrastructure problems

### For Others Attempting This

**If you have Apple Silicon:**
- Expect QEMU performance limitations
- Focus on learning, not performance
- Consider cloud instances for production testing

**If you have Intel/AMD:**
- KVM will work much better
- Performance will be acceptable
- Follow similar setup with x86 images

**Regardless of hardware:**
- Start simple (Cirros VMs)
- Build up complexity gradually
- Document everything
- Don't give up when things fail!

---

## Resources

### Official Documentation
- [OpenStack Documentation](https://docs.openstack.org/)
- [DevStack Documentation](https://docs.openstack.org/devstack/latest/)
- [VMware Fusion Documentation](https://docs.vmware.com/en/VMware-Fusion/)

### Useful Links
- [Ubuntu ARM64 ISOs](https://ubuntu.com/download/server/arm)
- [Fedora ARM64 Images](https://alt.fedoraproject.org/alt/)
- [OpenStack CLI Reference](https://docs.openstack.org/python-openstackclient/latest/)

### Community
- [OpenStack Mailing Lists](https://www.openstack.org/community/)
- [Ask OpenStack](https://ask.openstack.org/)

---

---

## Conclusion

Setting up OpenStack on Apple Silicon was challenging, educational, and ultimately rewarding. While the performance limitations of QEMU made some tasks impractical, the journey provided invaluable hands-on experience with cloud infrastructure, networking, and complex problem-solving.

**The best way to learn is by doing—even when (especially when) things don't work perfectly the first time.**

Happy cloud building!
