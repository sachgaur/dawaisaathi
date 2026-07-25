# DawaiSathi — Senior Architecture & Pre-Production Design

As your senior developer, my goal is to design a production-grade, highly scalable architecture. We are dropping the Next.js monolithic approach from the original task and moving to a decoupled, high-performance architecture using a modern Python backend. 

## 1. The Tech Stack Selection

### Frontend: React + Vite + TypeScript (PWA)
Since we are building an offline-first PWA and moving the backend to Python, we don't need Next.js's Server-Side Rendering (SSR). A Single Page Application (SPA) built with Vite is incredibly fast, creates a smaller bundle (which makes hitting that 90+ Lighthouse score much easier), and pairs perfectly with `vite-plugin-pwa` for robust offline service workers.

### Backend API: Django or Flask (Python)
Absolutely! Both are excellent choices for a high-quality product, depending on our exact needs:
- **Django (Recommended for Speed & Structure):** Provides a "batteries-included" experience. It comes with a built-in admin panel (perfect for managing users/family groups), a robust ORM, and excellent security out of the box. We would use **Django REST Framework (DRF)** to build the API.
- **Flask (Recommended for Lightweight Control):** If we want maximum control over every component without the overhead of Django, Flask is perfect. We can pair it with `Flask-RESTful` and `SQLAlchemy`.

### Database: MySQL (Primary) with PostgreSQL (Fallback)
We will use a relational database to store Family Groups, Users, and Medicine Schedules. 
- **MySQL** is an absolute powerhouse and a perfect primary option for this project. It is highly scalable, extremely reliable, and widely supported. 
- **PostgreSQL** can serve as an alternative or fallback option. Because both Django's ORM and Flask's SQLAlchemy abstract the database layer, switching between MySQL and PostgreSQL requires almost zero code changes—it's simply a matter of changing a connection string in the environment variables.

### Background Workers: Celery + Redis
For CRON jobs and push notifications, we cannot rely on simple python loops. We need an enterprise-grade message broker. **Celery** with **Redis** will handle queuing push notifications exactly when a medicine is due, without slowing down the main Django/Flask server.

### AI Integration: Gemini Flash API
Our Python backend will handle the image processing. The frontend securely sends the image to our Python API, the API communicates with Gemini, validates the response, and sends clean JSON back to the frontend.

---

## 2. System Architecture & Data Flow

### The 6-Digit Sync Flow
1. **Creation:** A user creates a "Patient". The Python backend generates a random 6-digit `family_code` and creates a record in the `FamilyGroup` MySQL table.
2. **Real-time Updates:** When a caregiver taps "Medicine Taken," the React frontend makes an asynchronous `POST` request to the backend. The backend updates MySQL.
3. **Offline Handling:** If the caregiver is offline, the React frontend uses the browser's `IndexedDB` to queue the action. Once the device reconnects to the internet, a background sync flushes the queue to the backend to ensure data integrity.

### The Notification Infrastructure (The most complex part)
1. **Scheduling:** When a user schedules a medicine for "Morning (8:00 AM)", the Python backend saves this schedule in MySQL.
2. **The Worker:** Celery Beat runs a background task every 5 minutes: *"Find all medicines due in the next 5 minutes."*
3. **The Push:** For every due medicine, Celery looks up all Web Push device tokens associated with that 6-digit `family_code` and fires off the Web Push API payload asynchronously to all family members.

---

## 3. The Path to a 90+ Lighthouse Score

To ensure our frontend is blazing fast and achieves top-tier performance/accessibility scores:
1. **Asset Optimization:** We will code-split our React routes so the initial JavaScript load is tiny.
2. **Image Compression:** We will compress blister pack photos on the client side before uploading them to the server to save bandwidth.
3. **TailwindCSS Purging:** We will use TailwindCSS, which automatically removes all unused CSS, resulting in a microscopic stylesheet.
4. **Accessibility First:** We will enforce WCAG high-contrast ratios and ARIA labels (essential for elderly users) to guarantee a 100 on the Lighthouse Accessibility metric.

---

## 4. Next Steps for Implementation
If you are aligned with this architecture, we can proceed with:
1. Initializing the Django/Flask & MySQL backend.
2. Initializing the React + Vite frontend environment.
3. Drafting the core database schema.
