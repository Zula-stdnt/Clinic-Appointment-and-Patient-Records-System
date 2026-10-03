-- Sanitized seed data
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;

INSERT INTO `roles` (`role_id`, `role_name`) VALUES
(1, 'Administrator'),
(2, 'Receptionist'),
(3, 'Doctor')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);

INSERT INTO `specialties` (`specialty_id`, `specialty_name`) VALUES
(1, 'Cardiology'),
(2, 'Pediatrics'),
(3, 'General Surgery'),
(4, 'Dermatology'),
(5, 'Orthopedics'),
(6, 'Neurology'),
(7, 'Internal Medicine')
ON DUPLICATE KEY UPDATE `specialty_name` = VALUES(`specialty_name`);

/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;

