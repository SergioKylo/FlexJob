using System;
using System.IO;
using System.Collections.Generic;
using MySqlConnector;

public static class Database
{
    private static readonly string ConnectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING") 
        ?? "Server=localhost;Port=3306;Database=flexjob;Uid=root;Pwd=rootpassword;";

    private static string Hash(string password)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    public static void Initialize()
    {
        int maxRetries = 15;
        int delaySeconds = 3;
        MySqlConnection connection = null;

        for (int i = 1; i <= maxRetries; i++)
        {
            try
            {
                connection = new MySqlConnection(ConnectionString);
                connection.Open();
                Console.WriteLine("Successfully connected to MySQL database.");
                break;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Attempt {i}/{maxRetries}] Database not ready yet: {ex.Message}. Retrying in {delaySeconds}s...");
                if (i == maxRetries) throw;
                System.Threading.Thread.Sleep(delaySeconds * 1000);
            }
        }

        using (connection)
        {
            try
            {
                // Users table
                var createUsers = @"
                    CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL, /* worker, employer */
                        avatar VARCHAR(500),
                        bio TEXT,
                        rating DOUBLE DEFAULT 5.0,
                        wallet_balance DOUBLE DEFAULT 0,
                        location_lat DOUBLE,
                        location_lng DOUBLE,
                        created_at VARCHAR(100) NOT NULL
                    );";
                ExecuteNonQueryInternal(createUsers, null, connection);

                // Jobs table
                var createJobs = @"
                    CREATE TABLE IF NOT EXISTS jobs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        description TEXT NOT NULL,
                        category VARCHAR(100) NOT NULL,
                        lat DOUBLE NOT NULL,
                        lng DOUBLE NOT NULL,
                        address VARCHAR(255) NOT NULL,
                        pay DOUBLE NOT NULL,
                        pay_type VARCHAR(50) NOT NULL, /* hourly, fixed */
                        duration VARCHAR(100),
                        status VARCHAR(50) NOT NULL, /* open, accepted, completed */
                        payment_status VARCHAR(50) NOT NULL DEFAULT 'none', /* none, escrowed, released */
                        payment_amount DOUBLE NOT NULL DEFAULT 0,
                        employer_id INT NOT NULL,
                        worker_id INT,
                        photo LONGTEXT, /* Base64 string for job photo */
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (employer_id) REFERENCES users(id),
                        FOREIGN KEY (worker_id) REFERENCES users(id)
                    );";
                ExecuteNonQueryInternal(createJobs, null, connection);

                // Applications table
                var createApplications = @"
                    CREATE TABLE IF NOT EXISTS applications (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        job_id INT NOT NULL,
                        worker_id INT NOT NULL,
                        status VARCHAR(50) NOT NULL, /* pending, accepted, rejected */
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (job_id) REFERENCES jobs(id),
                        FOREIGN KEY (worker_id) REFERENCES users(id),
                        UNIQUE KEY unique_job_worker (job_id, worker_id)
                    );";
                ExecuteNonQueryInternal(createApplications, null, connection);

                // Availabilities table
                var createAvailabilities = @"
                    CREATE TABLE IF NOT EXISTS availabilities (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        worker_id INT NOT NULL UNIQUE,
                        lat DOUBLE NOT NULL,
                        lng DOUBLE NOT NULL,
                        radius DOUBLE NOT NULL,
                        start_time VARCHAR(50),
                        end_time VARCHAR(50),
                        hourly_rate DOUBLE NOT NULL,
                        is_active INT NOT NULL DEFAULT 1,
                        FOREIGN KEY (worker_id) REFERENCES users(id)
                    );";
                ExecuteNonQueryInternal(createAvailabilities, null, connection);

                // Messages table
                var createMessages = @"
                    CREATE TABLE IF NOT EXISTS messages (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        from_user_id INT NOT NULL,
                        to_user_id INT NOT NULL,
                        job_id INT,
                        content TEXT NOT NULL,
                        message_type VARCHAR(50) NOT NULL DEFAULT 'text', /* text, application, payment_escrow, payment_released */
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (from_user_id) REFERENCES users(id),
                        FOREIGN KEY (to_user_id) REFERENCES users(id),
                        FOREIGN KEY (job_id) REFERENCES jobs(id)
                    );";
                ExecuteNonQueryInternal(createMessages, null, connection);

                // Reports table
                var createReports = @"
                    CREATE TABLE IF NOT EXISTS reports (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        reporter_id INT NOT NULL,
                        reported_user_id INT NOT NULL,
                        job_id INT,
                        reason TEXT,
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (reporter_id) REFERENCES users(id),
                        FOREIGN KEY (reported_user_id) REFERENCES users(id)
                    );";
                ExecuteNonQueryInternal(createReports, null, connection);

                // Reviews table
                var createReviews = @"
                    CREATE TABLE IF NOT EXISTS reviews (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        job_id INT NOT NULL,
                        from_user_id INT NOT NULL,
                        to_user_id INT NOT NULL,
                        rating DOUBLE NOT NULL,
                        comment TEXT,
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (job_id) REFERENCES jobs(id),
                        FOREIGN KEY (from_user_id) REFERENCES users(id),
                        FOREIGN KEY (to_user_id) REFERENCES users(id)
                    );";
                ExecuteNonQueryInternal(createReviews, null, connection);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error initializing database: {ex.Message}");
                throw;
            }
        }

        // Schema migrations — safe to fail if columns already exist
        try { ExecuteNonQuery("ALTER TABLE users ADD COLUMN wallet_balance DOUBLE NOT NULL DEFAULT 0"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE jobs ADD COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'none'"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE jobs ADD COLUMN payment_amount DOUBLE NOT NULL DEFAULT 0"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE jobs ADD COLUMN work_date VARCHAR(50) NOT NULL DEFAULT ''"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE users MODIFY COLUMN avatar MEDIUMTEXT"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE messages ADD COLUMN message_type VARCHAR(50) NOT NULL DEFAULT 'text'"); } catch { }

        // Seed mock data if database is empty
        try
        {
            var usersCountResult = ExecuteQuery("SELECT COUNT(*) as count FROM users;");
            int count = Convert.ToInt32(usersCountResult[0]["count"]);
            if (count == 0)
            {
                SeedMockData();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error seeding database: {ex.Message}");
        }

        // Always ensure admin account exists and has correct password/role
        try
        {
            string pwhash = Hash("123456");
            string nowStr = DateTime.UtcNow.ToString("o");
            var adminCheck = ExecuteQuery("SELECT id FROM users WHERE email = 'admin@flexjob.com'");
            if (adminCheck.Count == 0)
            {
                ExecuteNonQuery(
                    @"INSERT INTO users (name, email, password_hash, role, avatar, bio, rating, wallet_balance, location_lat, location_lng, created_at)
                      VALUES ('Admin FlexJob', 'admin@flexjob.com', @hash, 'admin', 'https://i.pravatar.cc/150?img=8', 'Administrador da plataforma FlexJob.', 5.0, 0, 38.7169, -9.1399, @now)",
                    new() { { "@hash", pwhash }, { "@now", nowStr } });
                Console.WriteLine("Admin user created.");
            }
            else
            {
                // Always reset password hash + role to guarantee login works
                ExecuteNonQuery(
                    "UPDATE users SET password_hash = @hash, role = 'admin' WHERE email = 'admin@flexjob.com'",
                    new() { { "@hash", pwhash } });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: could not ensure admin user: {ex.Message}");
        }

        // Ensure Braga users and jobs exist (added in later seed revision)
        try
        {
            string pwhash2 = Hash("123456");
            string now2 = DateTime.UtcNow.ToString("o");
            ExecuteNonQuery(@"
                INSERT IGNORE INTO users (id, name, email, password_hash, role, avatar, bio, rating, wallet_balance, location_lat, location_lng, created_at) VALUES
                (15, 'Braga Eventos & Catering', 'bragaevents@email.com', @hash, 'employer',
                    'https://i.pravatar.cc/150?img=11',
                    'Empresa local de eventos, casamentos e catering na região de Braga. Qualidade e tradição minhota.', 4.7, 350.0, 41.5454, -8.4265, @now),
                (16, 'Tiago Bento', 'tiago@email.com', @hash, 'worker',
                    'https://i.pravatar.cc/150?img=52',
                    'Estudante universitário em Braga. Disponível para eventos, catering e apoio geral. Energético e pontual.', 4.7, 0.0, 41.5510, -8.4310, @now),
                (17, 'Joana Vieira', 'joana@email.com', @hash, 'worker',
                    'https://i.pravatar.cc/150?img=39',
                    'Experiência em restauração e organização de eventos. Natural de Braga, conheço a cidade na perfeição.', 4.8, 20.0, 41.5400, -8.4200, @now),
                (18, 'Escola de Música do Minho', 'escolaminho@email.com', @hash, 'employer',
                    'https://i.pravatar.cc/150?img=57',
                    'Escola de música com 20 anos de história em Braga. Organizamos concertos, audições e eventos culturais.', 4.6, 200.0, 41.5520, -8.4180, @now),
                (19, 'Quinta das Lameiras', 'quintalameiras@email.com', @hash, 'employer',
                    'https://i.pravatar.cc/150?img=33',
                    'Espaço de eventos rurais em Braga. Casamentos, festas privadas e retiros corporativos com charme minhoto.', 4.9, 280.0, 41.5700, -8.3800, @now)",
                new() { { "@hash", pwhash2 }, { "@now", now2 } });

            ExecuteNonQuery(@"
                INSERT IGNORE INTO availabilities (worker_id, lat, lng, radius, start_time, end_time, hourly_rate, is_active) VALUES
                (16, 41.5510, -8.4310, 10.0, '10:00', '22:00', 10.0, 1),
                (17, 41.5400, -8.4200,  8.0, '09:00', '20:00', 11.0, 1)");

            string ragaPhoto2 = "https://picsum.photos/seed/braga2026/400/220";
            ExecuteNonQuery(@"
                INSERT IGNORE INTO jobs (id, title, description, category, lat, lng, address, pay, pay_type, duration, status, payment_status, payment_amount, employer_id, worker_id, work_date, photo, created_at) VALUES
                (16, 'Barman em Festa Académica',
                    'Servir bebidas e cocktails em festa de final de curso na Universidade do Minho. Ambiente animado e jovem.',
                    'restauracao', 41.5454, -8.4265, 'Universidade do Minho, Campus de Gualtar, Braga',
                    11.0, 'hourly', '5 horas', 'open', 'none', 0, 15, NULL, '2026-06-13', @photo, @now),
                (17, 'Apoio a Casamento em Quinta',
                    'Receção de convidados, montagem de mesas e apoio durante o jantar de casamento. Traje formal exigido.',
                    'eventos', 41.5600, -8.3900, 'Quinta dos Carvalhos, Braga',
                    13.0, 'hourly', '8 horas', 'open', 'none', 0, 15, NULL, '2026-06-28', @photo, @now),
                (18, 'Auxiliar de Cozinha em Restaurante',
                    'Preparação de mise en place, lavagem de louça e apoio ao chef. Ritmo intenso ao almoço e jantar.',
                    'restauracao', 41.5495, -8.4280, 'Rua do Souto 48, Centro Histórico, Braga',
                    10.5, 'hourly', '4 horas', 'open', 'none', 0, 15, NULL, '2026-05-30', @photo, @now),
                (19, 'Promotor em Centro Comercial',
                    'Promover nova linha de produtos numa grande superfície comercial. Perfil simpático e comunicativo.',
                    'retalho', 41.5310, -8.4150, 'Braga Parque, Braga',
                    9.5, 'hourly', '6 horas', 'open', 'none', 0, 15, NULL, '2026-06-05', @photo, @now),
                (20, 'Limpeza Pós-Evento em Pavilhão',
                    'Limpeza geral do pavilhão após evento desportivo. Varrer, lavar pavimento e recolher lixo.',
                    'casa', 41.5550, -8.4100, 'Pavilhão Desportivo Municipal, Braga',
                    10.0, 'hourly', '3 horas', 'open', 'none', 0, 15, NULL, '2026-05-27', @photo, @now),
                (21, 'Assistente em Concerto de Piano',
                    'Apoio na receção de público, acomodação de convidados e montagem de palco para concerto de música clássica.',
                    'eventos', 41.5520, -8.4180, 'Escola de Música do Minho, Rua Nova, Braga',
                    11.0, 'hourly', '4 horas', 'open', 'none', 0, 18, NULL, '2026-06-10', @photo, @now),
                (22, 'Monitor de Oficina Musical',
                    'Apoio a workshop infantil de percussão. Experiência com crianças valorizada. Material fornecido pela escola.',
                    'eventos', 41.5525, -8.4175, 'Escola de Música do Minho, Rua Nova, Braga',
                    12.0, 'hourly', '3 horas', 'open', 'none', 0, 18, NULL, '2026-06-17', @photo, @now),
                (23, 'Empregado de Buffet em Casamento',
                    'Servir buffet e bebidas num casamento de 150 convidados na quinta. Traje branco fornecido. Noite inteira.',
                    'restauracao', 41.5700, -8.3800, 'Quinta das Lameiras, Braga',
                    14.0, 'hourly', '8 horas', 'open', 'none', 0, 19, NULL, '2026-06-21', @photo, @now),
                (24, 'Segurança em Festa de Verão',
                    'Controlo de entradas e gestão de filas numa festa de verão ao ar livre. Postura profissional obrigatória.',
                    'eventos', 41.5710, -8.3790, 'Quinta das Lameiras, Braga',
                    13.5, 'hourly', '6 horas', 'open', 'none', 0, 19, NULL, '2026-06-28', @photo, @now)",
                new() { { "@photo", ragaPhoto2 }, { "@now", now2 } });
            Console.WriteLine("Braga data migration applied.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: could not apply Braga migration: {ex.Message}");
        }
    }

    private static void SeedMockData()
    {
        Console.WriteLine("Seeding mock data into MySQL database...");
        string pwhash = Hash("123456");
        string now    = DateTime.UtcNow.ToString("o");
        string d1ago  = DateTime.UtcNow.AddDays(-1).ToString("o");
        string d3ago  = DateTime.UtcNow.AddDays(-3).ToString("o");
        string d7ago  = DateTime.UtcNow.AddDays(-7).ToString("o");
        string d14ago = DateTime.UtcNow.AddDays(-14).ToString("o");

        // ── 1. ADMIN ──────────────────────────────────────────────────────────
        ExecuteNonQuery(@"
            INSERT INTO users (id, name, email, password_hash, role, avatar, bio, rating, wallet_balance, location_lat, location_lng, created_at)
            VALUES (1, 'Admin FlexJob', 'admin@flexjob.com', @hash, 'admin',
                    'https://i.pravatar.cc/150?img=8',
                    'Administrador da plataforma FlexJob.', 5.0, 0, 38.7169, -9.1399, @d14ago);",
            new() { { "@hash", pwhash }, { "@d14ago", d14ago } });

        // ── 2. EMPLOYERS ──────────────────────────────────────────────────────
        ExecuteNonQuery(@"
            INSERT INTO users (id, name, email, password_hash, role, avatar, bio, rating, wallet_balance, location_lat, location_lng, created_at)
            VALUES
            (2, 'Café Aurora',                'cafeaurora@email.com', @hash, 'employer',
                'https://i.pravatar.cc/150?img=26',
                'Café acolhedor no centro de Lisboa com pastelaria fina e brunch ao fim de semana.', 4.8, 320.0, 38.7109, -9.1424, @d14ago),
            (3, 'LX Eventos',                 'lxeventos@email.com',  @hash, 'employer',
                'https://i.pravatar.cc/150?img=14',
                'Agência líder em organização de concertos, festivais e congressos em Portugal.', 4.7, 580.0, 41.1496, -8.6110, @d14ago),
            (4, 'Norte Logística',            'nortelog@email.com',   @hash, 'employer',
                'https://i.pravatar.cc/150?img=33',
                'Distribuição expressa e fulfillment no norte de Portugal. ISO 9001 certificados.', 4.6, 210.0, 40.2056, -8.4196, @d14ago),
            (5, 'Restaurante Solar dos Mouros','solar@email.com',      @hash, 'employer',
                'https://i.pravatar.cc/150?img=53',
                'Cozinha portuguesa tradicional com vista para o Castelo de São Jorge. Desde 1987.', 4.9, 440.0, 38.7080, -9.1320, @d7ago),
            (6, 'Hotel Baia Cascais',          'hotelbaia@email.com',  @hash, 'employer',
                'https://i.pravatar.cc/150?img=68',
                'Hotel boutique 4 estrelas na marina de Cascais. Atendimento personalizado.', 4.8, 190.0, 38.6979, -9.4215, @d7ago),
            (15,'Braga Eventos & Catering',    'bragaevents@email.com',@hash, 'employer',
                'https://i.pravatar.cc/150?img=11',
                'Empresa local de eventos, casamentos e catering na região de Braga. Qualidade e tradição minhota.', 4.7, 350.0, 41.5454, -8.4265, @d3ago);",
            new() { { "@hash", pwhash }, { "@d14ago", d14ago }, { "@d7ago", d7ago }, { "@d3ago", d3ago } });

        // ── 3. WORKERS ────────────────────────────────────────────────────────
        ExecuteNonQuery(@"
            INSERT INTO users (id, name, email, password_hash, role, avatar, bio, rating, wallet_balance, location_lat, location_lng, created_at)
            VALUES
            (7,  'Inês Costa',     'ines@email.com',    @hash, 'worker',
                 'https://i.pravatar.cc/150?img=16',
                 'Experiência em cafés, bar, receção de hotéis e check-in de eventos. Inglês fluente.', 4.9, 174.0, 38.7240, -9.1510, @d14ago),
            (8,  'Miguel Rocha',   'miguel@email.com',  @hash, 'worker',
                 'https://i.pravatar.cc/150?img=12',
                 'Disponível para logística, armazéns, cargas leves e condução local. Carta B.', 4.8,  76.0, 41.1633, -8.6177, @d14ago),
            (9,  'Sara Martins',   'sara@email.com',    @hash, 'worker',
                 'https://i.pravatar.cc/150?img=20',
                 'Especialista em limpezas residenciais e hoteleiras. Rápida, discreta e rigorosa.', 4.7,  36.0, 40.1989, -8.4043, @d7ago),
            (10, 'Beatriz Santos', 'beatriz@email.com', @hash, 'worker',
                 'https://i.pravatar.cc/150?img=44',
                 'Estudante de hotelaria. Inglês, Francês e Espanhol. Foco em atendimento ao cliente.', 4.8,   0.0, 38.7355, -9.1432, @d7ago),
            (11, 'Carlos Silva',   'carlos@email.com',  @hash, 'worker',
                 'https://i.pravatar.cc/150?img=22',
                 'Estafeta urbano e motorista. Bicicleta e trotinete elétrica. Conheço Lisboa muito bem.', 4.6,  44.0, 38.7200, -9.1380, @d3ago),
            (12, 'Ana Sousa',      'ana@email.com',     @hash, 'worker',
                 'https://i.pravatar.cc/150?img=47',
                 'Feiras, mercados e eventos ao ar livre. Energia e simpatia garantidas!', 4.7,  40.0, 38.7150, -9.1290, @d3ago),
            (13, 'Rui Fernandes',  'rui@email.com',     @hash, 'worker',
                 'https://i.pravatar.cc/150?img=57',
                 'Técnico de som freelance. Monto e opero sistemas PA para concertos e eventos.', 4.9,   0.0, 41.1550, -8.6050, @d1ago),
            (14, 'Marta Pereira',  'marta@email.com',   @hash, 'worker',
                 'https://i.pravatar.cc/150?img=64',
                 'Cozinheira de linha com 6 anos de experiência em restaurantes e catering.', 4.8,  60.0, 38.7090, -9.1350, @d1ago),
            (16, 'Tiago Bento',    'tiago@email.com',   @hash, 'worker',
                 'https://i.pravatar.cc/150?img=52',
                 'Estudante universitário em Braga. Disponível para eventos, catering e apoio geral. Energético e pontual.', 4.7,   0.0, 41.5510, -8.4310, @d3ago),
            (17, 'Joana Vieira',   'joana@email.com',   @hash, 'worker',
                 'https://i.pravatar.cc/150?img=39',
                 'Experiência em restauração e organização de eventos. Natural de Braga, conheço a cidade na perfeição.', 4.8,  20.0, 41.5400, -8.4200, @d3ago);",
            new() { { "@hash", pwhash }, { "@d14ago", d14ago }, { "@d7ago", d7ago }, { "@d3ago", d3ago }, { "@d1ago", d1ago } });

        // ── 4. AVAILABILITIES ─────────────────────────────────────────────────
        ExecuteNonQuery(@"
            INSERT INTO availabilities (worker_id, lat, lng, radius, start_time, end_time, hourly_rate, is_active) VALUES
            ( 7, 38.7240, -9.1510, 10.0, '09:00', '18:00', 10.0, 1),
            ( 8, 41.1633, -8.6177, 15.0, '08:00', '20:00', 11.5, 1),
            ( 9, 40.1989, -8.4043,  8.0, '14:00', '19:00',  9.0, 1),
            (10, 38.7355, -9.1432,  5.0, '10:00', '17:00', 10.0, 1),
            (11, 38.7200, -9.1380, 12.0, '07:00', '22:00', 11.0, 1),
            (12, 38.7150, -9.1290,  8.0, '09:00', '19:00', 10.0, 1),
            (13, 41.1550, -8.6050, 10.0, '12:00', '23:00', 15.0, 1),
            (14, 38.7090, -9.1350,  6.0, '08:00', '16:00', 12.0, 1),
            (16, 41.5510, -8.4310, 10.0, '10:00', '22:00', 10.0, 1),
            (17, 41.5400, -8.4200,  8.0, '09:00', '20:00', 11.0, 1);");

        // ── 5. JOBS ───────────────────────────────────────────────────────────
        string cafePhoto  = "https://picsum.photos/seed/cafechiado/400/220";
        string eventPhoto = "https://picsum.photos/seed/festival2026/400/220";
        string logPhoto   = "https://picsum.photos/seed/warehouse99/400/220";
        string solarPhoto = "https://picsum.photos/seed/restaurant77/400/220";
        string hotelPhoto = "https://picsum.photos/seed/hotelcascais/400/220";
        string ragaPhoto  = "https://picsum.photos/seed/braga2026/400/220";

        ExecuteNonQuery(@"
            INSERT INTO jobs (id, title, description, category, lat, lng, address, pay, pay_type, duration, status, payment_status, payment_amount, employer_id, worker_id, work_date, photo, created_at)
            VALUES
            -- OPEN jobs
            (1,  'Apoio de Mesa no Chiado',
                 'Servir mesas, acolher clientes e recolher pratos no horário de almoço. Experiência mínima de 6 meses em restauração.',
                 'restauracao', 38.7109, -9.1424, 'Rua Garrett 15, Chiado, Lisboa',
                 11.0, 'hourly', '4 horas', 'open', 'none', 0, 2, NULL, '2026-06-02', @cafePhoto, @now),
            (2,  'Montagem de Festival Porto',
                 'Apoio na montagem de stands de comida, cadeiras e grades de proteção. Trazer calçado de biqueira de aço.',
                 'eventos', 41.1496, -8.6110, 'Parque da Cidade, Porto',
                 12.0, 'hourly', '6 horas', 'open', 'none', 0, 3, NULL, '2026-06-07', @eventPhoto, @now),
            (3,  'Cargas e Descargas Coimbra',
                 'Organização de caixotes no armazém principal e descarga de camião local. Trabalho físico moderado.',
                 'logistica', 40.2056, -8.4196, 'Zona Industrial da Pedrulha, Coimbra',
                 10.0, 'hourly', '3 horas', 'open', 'none', 0, 4, NULL, '2026-05-26', @logPhoto, @now),
            (6,  'Serviço de Bar em Jantar de Gala',
                 'Servir cocktails e vinhos num jantar de empresa para 80 convidados. Traje formal obrigatório.',
                 'restauracao', 38.7080, -9.1320, 'Rua do Alecrim 7, Bica, Lisboa',
                 12.0, 'hourly', '5 horas', 'open', 'none', 0, 5, NULL, '2026-06-14', @solarPhoto, @now),
            (7,  'Rececionista Fim de Semana',
                 'Atendimento presencial a hóspedes, check-in/check-out e gestão de reclamações. Inglês obrigatório.',
                 'retalho', 38.6979, -9.4215, 'Avenida Marginal 10, Cascais',
                 10.5, 'hourly', '8 horas', 'open', 'none', 0, 6, NULL, '2026-05-31', @hotelPhoto, @now),
            (10, 'Apoio em Concerto Rock',
                 'Controlo de acessos VIP, acompanhamento de artistas e apoio logístico ao staff.',
                 'eventos', 41.1550, -8.6050, 'Super Bock Arena, Porto',
                 13.0, 'hourly', '6 horas', 'open', 'none', 0, 3, NULL, '2026-06-20', @eventPhoto, @now),
            (12, 'Ajuda em Mudança de Casa',
                 'Transportar e desmontar móveis de apartamento T3. Elevador disponível. Material de embrulho fornecido.',
                 'logistica', 38.7109, -9.1424, 'Rua da Misericórdia 30, Lisboa',
                 12.0, 'hourly', '5 horas', 'open', 'none', 0, 2, NULL, '2026-05-28', @cafePhoto, @now),
            (13, 'Distribuição de Flyers Porto',
                 'Distribuição de flyers e vouchers na baixa do Porto. Perfil comunicativo e simpático.',
                 'retalho', 41.1496, -8.6110, 'Avenida dos Aliados, Porto',
                 8.5, 'hourly', '3 horas', 'open', 'none', 0, 3, NULL, '2026-05-27', @eventPhoto, @now),
            (15, 'Segurança em Evento Privado',
                 'Controlo de entradas e supervisão de área VIP em festa privada na Quinta de Monserrate.',
                 'eventos', 38.7963, -9.3916, 'Quinta de Monserrate, Sintra',
                 14.0, 'hourly', '6 horas', 'open', 'none', 0, 5, NULL, '2026-06-21', @solarPhoto, @now),

            -- BRAGA jobs
            (16, 'Barman em Festa Académica',
                 'Servir bebidas e cocktails em festa de final de curso na Universidade do Minho. Ambiente animado e jovem.',
                 'restauracao', 41.5454, -8.4265, 'Universidade do Minho, Campus de Gualtar, Braga',
                 11.0, 'hourly', '5 horas', 'open', 'none', 0, 15, NULL, '2026-06-13', @ragaPhoto, @now),
            (17, 'Apoio a Casamento em Quinta',
                 'Receção de convidados, montagem de mesas e apoio durante o jantar de casamento. Traje formal exigido.',
                 'eventos', 41.5600, -8.3900, 'Quinta dos Carvalhos, Braga',
                 13.0, 'hourly', '8 horas', 'open', 'none', 0, 15, NULL, '2026-06-28', @ragaPhoto, @now),
            (18, 'Auxiliar de Cozinha em Restaurante',
                 'Preparação de mise en place, lavagem de louça e apoio ao chef. Ritmo intenso ao almoço e jantar.',
                 'restauracao', 41.5495, -8.4280, 'Rua do Souto 48, Centro Histórico, Braga',
                 10.5, 'hourly', '4 horas', 'open', 'none', 0, 15, NULL, '2026-05-30', @ragaPhoto, @now),
            (19, 'Promotor em Centro Comercial',
                 'Promover nova linha de produtos numa grande superfície comercial. Perfil simpático e comunicativo.',
                 'retalho', 41.5310, -8.4150, 'Braga Parque, Braga',
                 9.5, 'hourly', '6 horas', 'open', 'none', 0, 15, NULL, '2026-06-05', @ragaPhoto, @now),
            (20, 'Limpeza Pós-Evento em Pavilhão',
                 'Limpeza geral do pavilhão após evento desportivo. Varrer, lavar pavimento e recolher lixo.',
                 'casa', 41.5550, -8.4100, 'Pavilhão Desportivo Municipal, Braga',
                 10.0, 'hourly', '3 horas', 'open', 'none', 0, 15, NULL, '2026-05-27', @ragaPhoto, @now),

            -- ACCEPTED jobs (payment escrowed)
            (8,  'Estafeta Urbano Lisboa',
                 'Entregas de pequenas encomendas no centro de Lisboa de bicicleta ou trotinete elétrica.',
                 'logistica', 38.7200, -9.1380, 'Praça do Comércio, Lisboa',
                 11.0, 'hourly', '4 horas', 'accepted', 'escrowed', 44.0, 2, 11, '2026-05-24', @cafePhoto, @d1ago),
            (11, 'Montagem de Bancas no Mercado',
                 'Montagem e desmontagem de bancas do mercado semanal. Trabalho matinal das 06h às 12h.',
                 'eventos', 38.7150, -9.1290, 'Largo de Intendente, Lisboa',
                 10.0, 'hourly', '4 horas', 'accepted', 'escrowed', 40.0, 5, 12, '2026-05-24', @solarPhoto, @d1ago),

            -- COMPLETED jobs (payment released)
            (4,  'Limpeza de Cozinha Exaustiva',
                 'Limpeza profunda de bancadas, fornos e louças após evento privado. Produtos fornecidos.',
                 'casa', 38.7109, -9.1424, 'Rua de São Paulo 23, Cais do Sodré, Lisboa',
                 13.5, 'hourly', '4 horas', 'completed', 'released', 54.0, 2, 7, '2026-05-15', @cafePhoto, @d7ago),
            (5,  'Ajudante de Inventário Loja',
                 'Contagem manual de stock de vestuário e etiquetagem de novas peças.',
                 'retalho', 41.1496, -8.6110, 'Rua de Santa Catarina 88, Porto',
                 9.5, 'hourly', '8 horas', 'completed', 'released', 76.0, 3, 8, '2026-05-10', @eventPhoto, @d7ago),
            (9,  'Limpeza de Quartos de Hotel',
                 'Limpeza e preparação de 12 quartos duplos. Roupa de cama e produtos fornecidos pelo hotel.',
                 'casa', 38.6979, -9.4215, 'Rua da Saudade 5, Cascais',
                 9.0, 'hourly', '4 horas', 'completed', 'released', 36.0, 6, 9, '2026-05-18', @hotelPhoto, @d7ago),
            (14, 'Chef de Linha no Jantar de Gala',
                 'Preparação e emplatamento de entradas e sobremesas para 120 convidados num evento de luxo.',
                 'restauracao', 38.7080, -9.1320, 'Hotel Bairro Alto, Lisboa',
                 15.0, 'hourly', '4 horas', 'completed', 'released', 60.0, 5, 7, '2026-05-20', @solarPhoto, @d7ago);",
            new() {
                { "@cafePhoto",  cafePhoto  },
                { "@eventPhoto", eventPhoto },
                { "@logPhoto",   logPhoto   },
                { "@solarPhoto", solarPhoto },
                { "@hotelPhoto", hotelPhoto },
                { "@ragaPhoto",  ragaPhoto  },
                { "@now",    now    },
                { "@d1ago",  d1ago  },
                { "@d7ago",  d7ago  },
            });

        // ── 6. APPLICATIONS ───────────────────────────────────────────────────
        ExecuteNonQuery(@"
            INSERT INTO applications (job_id, worker_id, status, created_at) VALUES
            ( 1,  7, 'pending', @now),
            ( 1, 10, 'pending', @now),
            ( 2, 13, 'pending', @now),
            ( 6, 14, 'pending', @now),
            ( 7, 10, 'pending', @now),
            (10, 13, 'pending', @now),
            (12, 11, 'pending', @now),
            (15, 12, 'pending', @now);",
            new() { { "@now", now } });

        // ── 7. REVIEWS ────────────────────────────────────────────────────────
        ExecuteNonQuery(@"
            INSERT INTO reviews (job_id, from_user_id, to_user_id, rating, comment, created_at) VALUES
            ( 4, 2,  7, 4.9, 'A Inês foi fantástica! Limpeza impecável e postura super profissional. Voltamos a contactar.', @d7ago),
            ( 4, 7,  2, 5.0, 'Excelente empregador. Trabalho bem descrito, pagamento rápido. Muito recomendado!', @d7ago),
            ( 5, 3,  8, 4.8, 'O Miguel foi rápido e muito atento a detalhes. Ótima atitude durante as 8 horas.', @d7ago),
            ( 5, 8,  3, 4.7, 'Bom ambiente de trabalho. Explicaram tudo claramente. Recomendo a LX Eventos.', @d7ago),
            ( 9, 6,  9, 4.7, 'A Sara foi eficiente e discreta. Quartos impecáveis. Voltaremos a chamar.', @d7ago),
            ( 9, 9,  6, 4.8, 'Hotel bem organizado e simpático. Pagamento na hora. Voltaria a trabalhar aqui!', @d7ago),
            (14, 5,  7, 5.0, 'A Inês é excecional na cozinha! Velocidade e criatividade acima do esperado.', @d7ago),
            (14, 7,  5, 5.0, 'O Solar dos Mouros é fantástico para trabalhar. Equipa top e comida incrível!', @d7ago);",
            new() { { "@d7ago", d7ago } });

        // ── 8. MESSAGES ───────────────────────────────────────────────────────
        ExecuteNonQuery(@"
            INSERT INTO messages (from_user_id, to_user_id, job_id, content, message_type, created_at) VALUES
            ( 7, 2,  1, 'Olá! Vi a vossa vaga para apoio no Chiado. Tenho total disponibilidade para a hora de almoço.', 'text', @now),
            ( 2, 7,  1, 'Excelente Inês! Já trabalhaste com sistemas de registo de pedidos no telemóvel?', 'text', @now),
            ( 7, 2,  1, 'Sim! No meu último trabalho usávamos o WinRest. Estou bastante habituada.', 'text', @now),
            ( 2, 7,  1, 'Perfeito! Passas amanhã para uma conversa rápida? Das 14h às 15h?', 'text', @now),
            (10, 6,  7, 'Bom dia! Falo inglês, francês e espanhol. Tenho experiência na receção do Sheraton.', 'text', @now),
            ( 6,10,  7, 'Excelente Beatriz! Os idiomas são uma mais-valia. Vamos analisar a candidatura com atenção.', 'text', @now),
            (14, 5,  6, 'Boa tarde! Vi a vaga para serviço de bar. Tenho carta de bartender e experiência em eventos.', 'text', @now),
            ( 5,14,  6, 'Ótimo Marta! Podias partilhar mais sobre a tua experiência com cocktails?', 'text', @now),
            (14, 5,  6, 'Claro! Trabalhei 2 anos no bar do Hotel Ritz e tenho curso de mixologia pelo ISCTE.', 'text', @now),
            ( 8, 3,  2, 'Boa tarde. Consigo ajudar na montagem de stands no Porto. Levo botas de biqueira.', 'text', @now),
            ( 3, 8,  2, 'Perfeito Miguel! O ponto de encontro é junto ao palco principal às 10h. Até amanhã!', 'text', @now),
            (11, 2,  8, 'Bom dia! Tenho bicicleta própria e conheço Lisboa muito bem. Posso começar amanhã.', 'text', @d1ago),
            ( 2,11,  8, 'Ótimo Carlos! Então combinado para amanhã às 09h na Praça do Comércio.', 'text', @d1ago),
            ( 2,11,  8, 'Pagamento efetuado antecipadamente. Bom trabalho amanhã!', 'payment_escrow', @d1ago),
            (12, 5, 11, 'Olá! Tenho muita experiência em feiras e mercados. Quando posso começar?', 'text', @d1ago),
            ( 5,12, 11, 'Olá Ana! Podes vir amanhã às 05h45 ao Largo do Intendente?', 'text', @d1ago),
            ( 5,12, 11, 'Fizemos o pagamento antecipado. Bom trabalho amanhã de manhã!', 'payment_escrow', @d1ago),
            (13, 3, 10, 'Olá! Sou técnico de som profissional. Tenho experiência em concertos de grande formato.', 'text', @d1ago),
            ( 3,13, 10, 'Óptimo Rui! Podes enviar o teu portfolio ou referências de eventos anteriores?', 'text', @d1ago);",
            new() { { "@now", now }, { "@d1ago", d1ago } });

        Console.WriteLine("Database seeding completed successfully!");
    }

    public static int ExecuteNonQuery(string sql, Dictionary<string, object> parameters = null)
    {
        using var connection = new MySqlConnection(ConnectionString);
        connection.Open();
        return ExecuteNonQueryInternal(sql, parameters, connection);
    }

    private static int ExecuteNonQueryInternal(string sql, Dictionary<string, object> parameters, MySqlConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
            }
        }
        return command.ExecuteNonQuery();
    }

    public static List<Dictionary<string, object>> ExecuteQuery(string sql, Dictionary<string, object> parameters = null)
    {
        var results = new List<Dictionary<string, object>>();
        using var connection = new MySqlConnection(ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
            }
        }

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var row = new Dictionary<string, object>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            results.Add(row);
        }
        return results;
    }

    public static long GetLastInsertRowId()
    {
        using var connection = new MySqlConnection(ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT LAST_INSERT_ID();";
        return Convert.ToInt64(command.ExecuteScalar());
    }
}
