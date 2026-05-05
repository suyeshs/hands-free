# Documentation Index

Welcome to the Guanix Restaurant documentation. This directory contains all technical documentation organized by category.

---

## 📚 Quick Links

### Essential Documentation (Root Level)
- [Main README](../README.md) - Project overview and getting started
- [Build Guide](../BUILD_GUIDE.md) - Build instructions for all platforms
- [Testing Guide](../TESTING_GUIDE.md) - Testing procedures
- [Login Credentials](../LOGIN_CREDENTIALS.md) - Development credentials
- [Release Notes v3.1](../RELEASE_NOTES_v3.1.md) - Latest release information
- [Mobile Apps Implementation](../MOBILE_APPS_IMPLEMENTATION_SUMMARY.md) - Mobile architecture overview
- [Theme Libraries Integration](../THEME_LIBRARIES_INTEGRATION.md) - Theme system documentation

---

## 🏗️ Architecture Documentation

[View all architecture docs →](./architecture/)

High-level system architecture, design patterns, and workflows:

- Mobile app architecture (Android, Staff, Owner)
- Sync architecture and patterns
- Plugin system workflow
- Data workflow and routing
- Feature activation system
- Device mode and alignment
- Multi-location architecture
- Staff management system

---

## 📖 Developer Guides

[View all guides →](./guides/)

Step-by-step guides for developers:

- Implementation guides
- Plugin integration
- Database provisioning
- Multi-location setup
- Migration strategies
- Testing guides
- Background operations
- Sync integration

---

## 🧩 Plugin System

[View plugin documentation →](./plugins/)

Plugin system documentation including:

- Plugin Manifest V2 Migration
- Plugin Registry Deployment
- Plugin System Critical Fixes
- Plugin Update Mechanism
- Quick Reference Guides

---

## 📱 Mobile Applications

[View mobile documentation →](./mobile/)

Mobile app development documentation:

- Staff Mobile App
- Owner Mobile App
- Android Build Variants
- Tauri Android Integration

---

## 🔧 Infrastructure

[View infrastructure docs →](./infrastructure/)

Backend infrastructure and deployment:

- Plugin registry setup
- Cloudflare Workers integration
- D1 database provisioning
- R2 storage configuration

---

## 🔄 Worker Integration

[View worker integration reference →](./worker-integration-reference/)

Reference implementation for Cloudflare Workers:

- Handsfree Orders Worker
- Plugin System Integration
- Deployment checklists

---

## 📦 Archive

[View archived documentation →](./archive/)

Historical documentation including:

- **[Fixes Archive](./archive/fixes/)** - Temporary fix documents (112 files)
  - Loop/Routing fixes
  - Menu upload fixes
  - Database/Migration fixes
  - Setup/Wizard fixes
  - API/Sync fixes
  - UI/Theme fixes

- **[Outdated Docs](./archive/outdated/)** - Superseded documentation

---

## 🔍 Finding Documentation

### By Topic

- **Getting Started**: See root [README.md](../README.md)
- **Building the App**: [BUILD_GUIDE.md](../BUILD_GUIDE.md)
- **Architecture**: [architecture/](./architecture/)
- **Development**: [guides/](./guides/)
- **Plugins**: [plugins/](./plugins/)
- **Mobile Apps**: [mobile/](./mobile/)
- **Historical Fixes**: [archive/fixes/](./archive/fixes/)

### By Component

- **Frontend**: See Architecture docs
- **Backend/Workers**: [infrastructure/](./infrastructure/) and [worker-integration-reference/](./worker-integration-reference/)
- **Database**: Guides and Architecture docs
- **Mobile**: [mobile/](./mobile/)
- **Plugins**: [plugins/](./plugins/)

---

## 📝 Documentation Guidelines

### For Contributors

When adding new documentation:

1. **Essential docs** → Place at project root
2. **Architecture/Design** → `docs/architecture/`
3. **How-to guides** → `docs/guides/`
4. **Plugin docs** → `docs/plugins/`
5. **Mobile docs** → `docs/mobile/`
6. **Temporary fixes** → `docs/archive/fixes/` (with date)

### Naming Conventions

- Use UPPERCASE_WITH_UNDERSCORES for markdown files
- Be descriptive: `FEATURE_IMPLEMENTATION_GUIDE.md` not `GUIDE.md`
- Add dates to temporary documents: `FIX_ISSUE_2026_02_05.md`

---

## 🔄 Recent Updates

- **2026-02-05**: Major documentation reorganization
  - Moved 45 docs to organized structure
  - Archived 112 temporary fix documents
  - Created this documentation index

---

## 📧 Need Help?

- Check the [Main README](../README.md) for project overview
- Review [guides/](./guides/) for step-by-step instructions
- See [architecture/](./architecture/) for system design
- Contact the development team for specific questions

---

**Last Updated**: 2026-02-05
**Maintained By**: Development Team
