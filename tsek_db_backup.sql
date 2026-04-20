--
-- PostgreSQL database dump
--

\restrict ngShlbtQCzToqhYFQiKMUuoYz62mxNOeqxjacIEU8Ua5rv8zCcJ4FTJK3CXt13r

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: class_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.class_enrollments (
    class_id integer NOT NULL,
    student_id integer NOT NULL
);


ALTER TABLE public.class_enrollments OWNER TO postgres;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    instructor_id integer,
    class_name character varying(100) NOT NULL,
    section_code character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_id_seq OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: exam_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_results (
    id integer NOT NULL,
    exam_id integer,
    student_id integer,
    score integer NOT NULL,
    scanned_image_url character varying(255),
    graded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.exam_results OWNER TO postgres;

--
-- Name: exam_results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_results_id_seq OWNER TO postgres;

--
-- Name: exam_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_results_id_seq OWNED BY public.exam_results.id;


--
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    class_id integer,
    exam_title character varying(150) NOT NULL,
    total_items integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    config jsonb
);


ALTER TABLE public.exams OWNER TO postgres;

--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exams_id_seq OWNER TO postgres;

--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: instructors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instructors (
    id integer NOT NULL,
    prefix character varying(10),
    full_name character varying(100) NOT NULL,
    school_email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_verified boolean DEFAULT false,
    verification_token character varying(255)
);


ALTER TABLE public.instructors OWNER TO postgres;

--
-- Name: instructors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.instructors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.instructors_id_seq OWNER TO postgres;

--
-- Name: instructors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.instructors_id_seq OWNED BY public.instructors.id;


--
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    id integer NOT NULL,
    student_id_number character varying(50) NOT NULL,
    full_name character varying(100) NOT NULL
);


ALTER TABLE public.students OWNER TO postgres;

--
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.students_id_seq OWNER TO postgres;

--
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: exam_results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results ALTER COLUMN id SET DEFAULT nextval('public.exam_results_id_seq'::regclass);


--
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: instructors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors ALTER COLUMN id SET DEFAULT nextval('public.instructors_id_seq'::regclass);


--
-- Name: students id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- Data for Name: class_enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.class_enrollments (class_id, student_id) FROM stdin;
1	1
2	1
1	2
1	3
2	3
1	4
1	5
2	5
1	6
1	7
2	7
1	8
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classes (id, instructor_id, class_name, section_code, created_at) FROM stdin;
1	1	People and Earth's Ecosystem	BSIT - 1A&B	2026-04-20 08:51:58.054713
2	1	People and Earth's Ecosystem	BSCS - 1A&B	2026-04-20 08:51:58.058343
3	1	Science Technology and Society	BSIT - 1C&D	2026-04-20 08:51:58.059339
4	1	Science Technology and Society	BSCS - 1C&D	2026-04-20 08:51:58.060503
\.


--
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_results (id, exam_id, student_id, score, scanned_image_url, graded_at) FROM stdin;
1	1	1	2		2026-04-20 08:51:58.080802
2	1	2	23		2026-04-20 08:51:58.082711
3	1	3	31		2026-04-20 08:51:58.083296
4	1	4	9		2026-04-20 08:51:58.083845
5	1	5	22		2026-04-20 08:51:58.084372
6	2	1	44		2026-04-20 08:51:58.085508
7	2	2	97		2026-04-20 08:51:58.085988
8	2	3	8		2026-04-20 08:51:58.086326
9	2	4	66		2026-04-20 08:51:58.086771
10	2	5	48		2026-04-20 08:51:58.087303
11	3	1	11		2026-04-20 08:51:58.088489
12	3	2	36		2026-04-20 08:51:58.089272
13	3	3	23		2026-04-20 08:51:58.089778
14	3	4	27		2026-04-20 08:51:58.09033
15	3	5	12		2026-04-20 08:51:58.090762
16	4	1	95		2026-04-20 08:51:58.091535
17	4	2	36		2026-04-20 08:51:58.091883
18	4	3	25		2026-04-20 08:51:58.092188
19	4	4	43		2026-04-20 08:51:58.092607
20	4	5	2		2026-04-20 08:51:58.093004
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exams (id, class_id, exam_title, total_items, created_at, config) FROM stdin;
1	1	Quiz #1: Ecosystems	50	2026-04-20 08:51:58.078798	\N
2	1	Midterm Exams	100	2026-04-20 08:51:58.084928	\N
3	2	Quiz #1: Ecosystems	50	2026-04-20 08:51:58.087891	\N
4	3	Midterm Examination	100	2026-04-20 08:51:58.091108	\N
5	2	1st exam	50	2026-04-20 09:25:16.029987	[{"key": "multipleChoice", "label": "MULTIPLE CHOICE ITEMS", "enabled": true, "options": [20, 30, 50, 100], "selected": 30, "pointName": "Multiple Choice", "defaultPoints": 1}, {"key": "identification", "label": "IDENTIFICATION ITEMS", "enabled": true, "options": [10, 15, 20], "selected": 10, "pointName": "Identification", "defaultPoints": 2}, {"key": "enumeration", "label": "ENUMERATION ITEMS", "enabled": false, "options": [5, 10, 15, 20], "selected": 5, "pointName": "Enumeration", "defaultPoints": 1}, {"key": "trueOrFalse", "label": "TRUE OR FALSE ITEMS", "enabled": false, "options": [5, 10, 15, 20], "selected": 5, "pointName": "True or False", "defaultPoints": 1}]
\.


--
-- Data for Name: instructors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.instructors (id, prefix, full_name, school_email, password_hash, created_at, is_verified, verification_token) FROM stdin;
1	Mr.	Chris Allen Pineda	instructor@school.edu	$2b$10$VcXr0NMKPR92mZmBke7L1.SRxi2ICGbfiO.Qk6o3yAf0ZxGzepx9i	2026-04-20 08:51:58.048888	t	\N
3	Mr.	Markuz Gabriel G. Diosomito	202312278@gordoncollege.edu.ph	$2b$10$3VJ8RqBDETiOZZdWHfjcGeVI6GUK8IGG9JTK21QM.kXdkvpnPRmI6	2026-04-20 10:37:47.700456	t	\N
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.students (id, student_id_number, full_name) FROM stdin;
1	202000000	Markuz Gabriel Diosomito
2	202000001	Jerald Pangan
3	202000002	Ana Marie Santos
4	202000003	Juan Carlos Reyes
5	202000004	Maria Clara Cruz
6	202000005	Jose Rizal Garcia
7	202100010	Carlos Miguel Torres
8	202100011	Sofia Isabelle Reyes
\.


--
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_id_seq', 4, true);


--
-- Name: exam_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_results_id_seq', 20, true);


--
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exams_id_seq', 5, true);


--
-- Name: instructors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.instructors_id_seq', 3, true);


--
-- Name: students_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.students_id_seq', 8, true);


--
-- Name: class_enrollments class_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_pkey PRIMARY KEY (class_id, student_id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: instructors instructors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_pkey PRIMARY KEY (id);


--
-- Name: instructors instructors_school_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_school_email_key UNIQUE (school_email);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_student_id_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_id_number_key UNIQUE (student_id_number);


--
-- Name: class_enrollments class_enrollments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_enrollments class_enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: classes classes_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE CASCADE;


--
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: exam_results exam_results_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: exams exams_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ngShlbtQCzToqhYFQiKMUuoYz62mxNOeqxjacIEU8Ua5rv8zCcJ4FTJK3CXt13r

